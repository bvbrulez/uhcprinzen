export function createAuthService(client) {
  return {
    onAuthStateChange(callback) {
      return client.auth.onAuthStateChange(callback).data.subscription;
    },

    async getSession() {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session;
    },

    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data.session;
    },

    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },

    requestPasswordReset(email, redirectTo) {
      return client.auth.resetPasswordForEmail(email, { redirectTo });
    },

    updatePassword(password) {
      return client.auth.updateUser({ password });
    },
  };
}
