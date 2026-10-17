export function createTransactionService(client) {
  const receiptBucket = "transaction-receipts";
  const receiptMaxBytes = 10 * 1024 * 1024;
  const receiptMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

  function validateReceipt(file) {
    if (!file || !receiptMimeTypes.has(file.type)) {
      throw new Error("Belege müssen PDF-, JPEG-, PNG- oder WebP-Dateien sein.");
    }
    if (file.size > receiptMaxBytes) {
      throw new Error("Belege dürfen höchstens 10 MB groß sein.");
    }
  }

  function receiptObjectName(file) {
    const baseName = (file.name || "beleg").replaceAll("\\", "/").split("/").at(-1);
    const safeName = baseName
      .normalize("NFC")
      .replace(/[^\p{L}\p{N}._-]+/gu, "_")
      .replace(/^\.+/, "")
      .slice(0, 120) || "beleg";
    return `${crypto.randomUUID()}-${safeName}`;
  }

  async function validateTransaction(transaction, id = null) {
    const { amount, transaction_date, description } = transaction;
    const warnings = [];

    if (amount > 1000) {
      warnings.push(`Der Betrag von ${money(amount)} ist ungewöhnlich hoch. Bitte prüfen Sie die Eingabe.`);
    }

    if (id) {
      const { data: duplicates } = await client.from("transactions")
        .select("id")
        .neq("id", id)
        .eq("amount", amount)
        .eq("transaction_date", transaction_date)
        .ilike("description", `%${description.slice(0, 10)}%`)
        .is("deleted_at", null);
      if (duplicates?.length > 0) {
        warnings.push("Es scheint eine ähnliche Buchung am selben Tag mit demselben Betrag zu existieren.");
      }
    } else {
      const { data: duplicates } = await client.from("transactions")
        .select("id")
        .eq("amount", amount)
        .eq("transaction_date", transaction_date)
        .ilike("description", `%${description.slice(0, 10)}%`)
        .is("deleted_at", null);
      if (duplicates?.length > 0) {
        warnings.push("Es gibt bereits eine Buchung mit demselben Betrag und Datum. Handelt es sich um eine Dublette?");
      }
    }

    return warnings;
  }

  async function loadYears(startDate) {
    const { data, error } = await client.rpc("get_transaction_years");
    if (!error) return (data || []).map(item => String(item.year));
    if (error.code !== "PGRST202") throw error;

    const { data: fallbackData, error: fallbackError } = await client.from("transactions")
      .select("transaction_date");
    if (fallbackError) throw fallbackError;
    return [...new Set(fallbackData
      .filter(item => item.transaction_date >= startDate)
      .map(item => item.transaction_date.slice(0, 4)))];
  }

  async function loadCategories() {
    const { data, error } = await client.from("transaction_categories")
      .select("name")
      .order("name");
    if (error) throw error;
    return (data || []).map(item => item.name);
  }

  return {
    async uploadReceipt(transactionId, file, previousPath = null) {
      validateReceipt(file);
      const path = `${transactionId}/${receiptObjectName(file)}`;
      const { error: uploadError } = await client.storage.from(receiptBucket).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { data, error } = await client.from("transactions")
        .update({ receipt_path: path, receipt_name: file.name })
        .eq("id", transactionId)
        .select("id")
        .single();
      if (error || !data) {
        const { error: cleanupError } = await client.storage.from(receiptBucket).remove([path]);
        if (error && cleanupError) {
          throw new Error(`Beleg konnte nicht zugeordnet werden (${error.message}); die hochgeladene Datei konnte auch nicht entfernt werden (${cleanupError.message}).`);
        }
        if (error) throw error;
        throw new Error("Beleg konnte keiner Buchung zugeordnet werden.");
      }
      if (previousPath) {
        const { error: cleanupError } = await client.storage.from(receiptBucket).remove([previousPath]);
        if (cleanupError) {
          throw new Error(`Der neue Beleg wurde gespeichert, der vorherige konnte aber nicht gelöscht werden: ${cleanupError.message}`);
        }
      }
    },

    async removeReceipt(transaction) {
      if (!transaction.receipt_path) return;
      const { error } = await client.from("transactions")
        .update({ receipt_path: null, receipt_name: null })
        .eq("id", transaction.id);
      if (error) throw error;
      const { error: removeError } = await client.storage.from(receiptBucket)
        .remove([transaction.receipt_path]);
      if (removeError) {
        throw new Error(`Der Belegverweis wurde entfernt, die Datei konnte aber nicht gelöscht werden: ${removeError.message}`);
      }
    },

    async createReceiptUrl(path) {
      const { data, error } = await client.storage.from(receiptBucket).createSignedUrl(path, 60);
      if (error) throw error;
      if (!data?.signedUrl) throw new Error("Für diesen Beleg konnte kein sicherer Link erstellt werden.");
      return data.signedUrl;
    },

    async addCategory(name) {
      const { error } = await client.from("transaction_categories").insert({ name });
      if (error) throw error;
    },

    async loadCategories() {
      return loadCategories();
    },

    async removeCategory(name) {
      const { error } = await client.from("transaction_categories").delete().eq("name", name);
      if (error) throw error;
    },

    async loadRowsForDates(dates) {
      const rows = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await client.from("transactions")
          .select("transaction_date, type, account, description, amount")
          .in("transaction_date", dates)
          .is("deleted_at", null)
          .range(offset, offset + 999);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data?.length || data.length < 1000) return rows;
      }
    },

    async importMany(transactions) {
      const { error } = await client.from("transactions").insert(transactions);
      if (error) throw error;
    },

    async loadRecentTransactions({ startDate, limit }) {
      const { data, error } = await client.from("transactions")
        .select("id, type, account, description, amount, transaction_date, category, reconciled_at")
        .gte("transaction_date", startDate)
        .is("deleted_at", null)
        .order("transaction_date", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },

    async loadPage({ filters, page, pageSize, startDate, asOfDate }) {
      let query = client.from("transactions")
        .select("id, type, account, description, amount, transaction_date, category, created_at, created_by_email, updated_at, updated_by_email, deleted_at, deleted_by_email, reconciled_at, reconciled_by_email, receipt_path, receipt_name", { count: "exact" })
        .gte("transaction_date", filters.dateRange.start)
        .lte("transaction_date", filters.dateRange.end)
        .order("transaction_date", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      query = filters.showDeleted
        ? query.not("deleted_at", "is", null)
        : query.is("deleted_at", null);
      if (filters.account !== "ALL") query = query.eq("account", filters.account);
      if (filters.type !== "ALL") query = query.eq("type", filters.type);
      if (filters.reconciliation === "OPEN") query = query.is("reconciled_at", null);
      if (filters.reconciliation === "RECONCILED") query = query.not("reconciled_at", "is", null);
      if (filters.search) {
        query = query.or(`description.ilike.%${filters.search}%,category.ilike.%${filters.search}%`);
      }

      const analytics = client.rpc("get_transaction_analytics", {
        p_year: Number(filters.year),
        p_account: filters.summary && filters.account !== "ALL" ? filters.account : null,
        p_type: filters.type === "ALL" ? null : filters.type,
        p_search: filters.search || null,
        p_start_date: filters.dateRange.start,
        p_end_date: filters.dateRange.end,
        p_reconciled: filters.reconciliation === "ALL" ? null : filters.reconciliation === "RECONCILED",
      });
      const currentYear = Number(asOfDate.slice(0, 4));
      const previousYear = currentYear - 1;
      const previousYearStart = `${previousYear}-01-01`;
      const month = Number(asOfDate.slice(5, 7));
      const day = Number(asOfDate.slice(8, 10));
      const previousYearLastDay = new Date(Date.UTC(previousYear, month, 0)).getUTCDate();
      const previousYearEnd = `${previousYear}-${String(month).padStart(2, "0")}-${String(Math.min(day, previousYearLastDay)).padStart(2, "0")}`;
      const yearlyAnalytics = client.rpc("get_transaction_analytics", {
        p_year: currentYear,
        p_account: null,
        p_type: null,
        p_search: null,
        p_start_date: `${currentYear}-01-01` < startDate ? startDate : `${currentYear}-01-01`,
        p_end_date: asOfDate,
        p_reconciled: null,
      });
      const previousYearAnalytics = previousYearStart >= startDate
        ? client.rpc("get_transaction_analytics", {
          p_year: previousYear,
          p_account: null,
          p_type: null,
          p_search: null,
          p_start_date: previousYearStart,
          p_end_date: previousYearEnd,
          p_reconciled: null,
        })
        : Promise.resolve({ data: null, error: null });
      const outcomes = await Promise.allSettled([
        query,
        analytics,
        yearlyAnalytics,
        previousYearAnalytics,
        loadYears(startDate),
        loadCategories(),
      ]);
      if (outcomes[0].status === "rejected") throw outcomes[0].reason;
      if (outcomes[0].value.error) throw outcomes[0].value.error;
      if (outcomes[1].status === "rejected") throw outcomes[1].reason;
      if (outcomes[1].value.error) throw outcomes[1].value.error;
      if (outcomes[2].status === "rejected") throw outcomes[2].reason;
      if (outcomes[2].value.error) throw outcomes[2].value.error;
      if (outcomes[3].status === "rejected") throw outcomes[3].reason;
      if (outcomes[3].value.error) throw outcomes[3].value.error;
      if (outcomes[4].status === "rejected") throw outcomes[4].reason;
      if (outcomes[5].status === "rejected") throw outcomes[5].reason;

      return {
        transactions: outcomes[0].value.data || [],
        count: outcomes[0].value.count || 0,
        analytics: outcomes[1].value.data,
        yearlyTotals: outcomes[2].value.data?.totals || {},
        currentYear,
        previousYearTotals: outcomes[3].value.data?.totals || null,
        years: outcomes[4].value,
        categories: outcomes[5].value,
      };
    },

    async loadMonthCloseAnalytics(month, endDate) {
      const parsedEndDate = /^\d{4}-\d{2}-\d{2}$/.test(endDate)
        ? new Date(`${endDate}T00:00:00Z`)
        : null;
      if (
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
        || !parsedEndDate
        || Number.isNaN(parsedEndDate.valueOf())
        || parsedEndDate.toISOString().slice(0, 10) !== endDate
        || !endDate.startsWith(`${month}-`)
      ) {
        throw new Error("Ungültiger Zeitraum für den Monatsabschluss.");
      }
      const { data, error } = await client.rpc("get_transaction_analytics", {
        p_year: Number(month.slice(0, 4)),
        p_account: null,
        p_type: null,
        p_search: null,
        p_start_date: `${month}-01`,
        p_end_date: endDate,
        p_reconciled: null,
      });
      if (error) throw error;
      return data || {};
    },

    async loadAudit(transactionId) {
      const { data, error } = await client.from("transaction_audit_log")
        .select("action, actor_email, occurred_at, old_data, new_data")
        .eq("transaction_id", transactionId)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async loadExportPage({ filters, dateRange, offset, limit, includeCount = false }) {
      let query = client.from("transactions")
        .select("id, type, account, description, amount, transaction_date, category, reconciled_at, reconciled_by_email", includeCount ? { count: "exact" } : {})
        .gte("transaction_date", dateRange.start)
        .lte("transaction_date", dateRange.end)
        .is("deleted_at", null)
        .order("transaction_date", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + limit - 1);
      if (filters.account !== "ALL") query = query.eq("account", filters.account);
      if (filters.type !== "ALL") query = query.eq("type", filters.type);
      if (filters.search) query = query.or(`description.ilike.%${filters.search}%,category.ilike.%${filters.search}%`);
      if (filters.reconciliation === "OPEN") query = query.is("reconciled_at", null);
      if (filters.reconciliation === "RECONCILED") query = query.not("reconciled_at", "is", null);
      const { data, count, error } = await query;
      if (error) throw error;
      return { data: data || [], count };
    },

    async loadAuditForExport(transactionIds) {
      const entries = [];
      for (let index = 0; index < transactionIds.length; index += 100) {
        const chunk = transactionIds.slice(index, index + 100);
        let offset = 0;
        while (true) {
          const { data, error } = await client.from("transaction_audit_log")
            .select("transaction_id, action, actor_email, occurred_at, old_data, new_data")
            .in("transaction_id", chunk)
            .order("occurred_at", { ascending: false })
            .range(offset, offset + 499);
          if (error) throw error;
          entries.push(...(data || []));
          if (entries.length > 10000) throw new Error("Der Änderungsverlauf umfasst mehr als 10.000 Einträge. Bitte den Zeitraum verkleinern.");
          if (!data?.length || data.length < 500) break;
          offset += data.length;
        }
      }
      return entries;
    },

    async save(transaction, id = null) {
      const warnings = await validateTransaction(transaction, id);
      const query = id
        ? client.from("transactions").update(transaction).eq("id", id).select("id")
        : client.from("transactions").insert(transaction);
      const { data, error } = await query;
      if (error) throw error;
      return { data, warnings };
    },

    async setReconciled(id, reconciled) {
      const { data, error } = await client.from("transactions")
        .update({ reconciled_at: reconciled ? new Date().toISOString() : null })
        .eq("id", id)
        .is("deleted_at", null)
        .select("id, reconciled_at");
      if (error) throw error;
      return data || [];
    },

    async reconcileMany(ids) {
      const { data, error } = await client.from("transactions")
        .update({ reconciled_at: new Date().toISOString() })
        .in("id", ids)
        .is("deleted_at", null)
        .is("reconciled_at", null)
        .select("id");
      if (error) throw error;
      return data || [];
    },

    async setDeleted(id, deleted) {
      let query = client.from("transactions")
        .update({ deleted_at: deleted ? new Date().toISOString() : null })
        .eq("id", id);
      query = deleted ? query.is("deleted_at", null) : query.not("deleted_at", "is", null);
      const { data, error } = await query.select("id, deleted_at");
      if (error) throw error;
      return data || [];
    }
  };
}
