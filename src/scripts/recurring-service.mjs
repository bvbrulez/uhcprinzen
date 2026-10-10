export function createRecurringService(client) {
  return {
    async load() {
      const { data, error } = await client.from("recurring_transactions")
        .select("id, type, account, description, amount, category, day_of_month, next_date, interval_type, end_date, active")
        .order("next_date");
      if (error) throw error;
      return data || [];
    },

    async save(schedule, id, createdBy) {
      const query = id
        ? client.from("recurring_transactions").update(schedule).eq("id", id)
        : client.from("recurring_transactions").insert({ ...schedule, created_by: createdBy });
      const { error } = await query;
      if (error) throw error;
    },

    async setActive(id, active) {
      const { error } = await client.from("recurring_transactions")
        .update({ active })
        .eq("id", id);
      if (error) throw error;
    },

    async createDue() {
      const { data, error } = await client.rpc("create_due_recurring_transactions");
      if (error) throw error;
      return data;
    },
  };
}
