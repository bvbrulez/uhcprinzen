export function createTransactionService(client) {
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

    async loadPage({ filters, page, pageSize, startDate }) {
      let query = client.from("transactions")
        .select("id, type, account, description, amount, transaction_date, category, created_at, created_by_email, updated_at, updated_by_email, deleted_at, deleted_by_email, reconciled_at, reconciled_by_email", { count: "exact" })
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
      const outcomes = await Promise.allSettled([
        query,
        analytics,
        loadYears(startDate),
        loadCategories(),
      ]);
      if (outcomes[0].status === "rejected") throw outcomes[0].reason;
      if (outcomes[0].value.error) throw outcomes[0].value.error;
      if (outcomes[1].status === "rejected") throw outcomes[1].reason;
      if (outcomes[1].value.error) throw outcomes[1].value.error;
      if (outcomes[2].status === "rejected") throw outcomes[2].reason;
      if (outcomes[3].status === "rejected") throw outcomes[3].reason;

      return {
        transactions: outcomes[0].value.data || [],
        count: outcomes[0].value.count || 0,
        analytics: outcomes[1].value.data,
        years: outcomes[2].value,
        categories: outcomes[3].value,
      };
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
      const query = id
        ? client.from("transactions").update(transaction).eq("id", id).select("id")
        : client.from("transactions").insert(transaction);
      const { data, error } = await query;
      if (error) throw error;
      return data;
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
    },
  };
}
