export function createContributionService(client) {
  return {
    async loadOverview() {
      const [members, settings, payments, quarters, rates] = await Promise.all([
        client.from("team_members").select("id, name, active").order("name"),
        client.from("team_contribution_settings")
          .select("quarterly_amount, bank_opening_balance, paypal_opening_balance")
          .eq("id", 1)
          .maybeSingle(),
        client.from("team_contribution_payments")
          .select("id, member_id, transaction_id, quarterly_amount, transaction:transactions(description, transaction_date)")
          .order("created_at", { ascending: false }),
        client.from("team_contribution_payment_quarters")
          .select("payment_id, member_id, quarter_start, quarterly_amount"),
        client.from("team_contribution_rates")
          .select("quarter_start, quarterly_amount")
          .order("quarter_start"),
      ]);
      for (const result of [members, settings, payments, quarters, rates]) {
        if (result.error) throw result.error;
      }
      return {
        members: members.data || [],
        settings: settings.data,
        payments: payments.data || [],
        quarters: quarters.data || [],
        rates: rates.data || [],
      };
    },

    async loadIncomeTransactions({ startDate, offset, search }) {
      let query = client.from("transactions")
        .select("id, description, amount, transaction_date")
        .eq("type", "INCOME")
        .gte("transaction_date", startDate)
        .is("deleted_at", null)
        .order("transaction_date", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + 99);
      if (search) query = query.ilike("description", `%${search}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async suggestMatches(transaction) {
      const { members, rates } = await this.loadOverview();
      const amount = Number(transaction.amount);
      const description = transaction.description.toLowerCase();

      // Find the applicable rate for the transaction date
      const txDate = new Date(transaction.transaction_date);
      const applicableRate = rates
        .filter(r => new Date(r.quarter_start) <= txDate)
        .sort((a, b) => new Date(b.quarter_start) - new Date(a.quarter_start))[0];

      const expectedAmount = applicableRate?.quarterly_amount || 0;

      return members
        .filter(m => m.active)
        .map(m => {
          let score = 0;
          if (description.includes(m.name.toLowerCase())) score += 10;
          if (amount === expectedAmount) score += 5;
          // Handle cases where multiple quarters are paid at once
          if (amount > 0 && amount % expectedAmount === 0) score += 2;
          
          return { member: m, score };
        })
        .filter(match => match.score > 0)
        .sort((a, b) => b.score - a.score);
    },

    async updateMember(member) {
      const { error } = await client.from("team_members")
        .update({ active: !member.active })
        .eq("id", member.id);
      if (error) throw error;
    },

    async removePayment(paymentId) {
      const { error } = await client.from("team_contribution_payments")
        .delete()
        .eq("id", paymentId);
      if (error) throw error;
    },

    async updateSettings({ bankBalance, paypalBalance, userId }) {
      const { error } = await client.from("team_contribution_settings")
        .update({
          bank_opening_balance: bankBalance,
          paypal_opening_balance: paypalBalance,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        })
        .eq("id", 1);
      if (error) throw error;
    },

    async setRate({ quarterStart, amount }) {
      const { error } = await client.rpc("set_team_contribution_rate", {
        p_quarter_start: quarterStart,
        p_quarterly_amount: amount,
      });
      if (error) throw error;
    },

    async addMember(name) {
      const { error } = await client.from("team_members").insert({ name });
      if (error) throw error;
    },

    async recordPayment({ memberId, transactionId, quarterStarts }) {
      const { error } = await client.rpc("record_team_contribution_payment", {
        p_member_id: memberId,
        p_transaction_id: transactionId,
        p_quarter_starts: quarterStarts,
      });
      if (error) throw error;
    },
  };
}
