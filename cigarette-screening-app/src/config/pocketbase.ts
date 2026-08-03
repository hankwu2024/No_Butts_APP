import PocketBase from 'pocketbase';

export const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090');

export const getUserId = (): string => {
  let id = localStorage.getItem('cigScreeningUserId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('cigScreeningUserId', id);
  }
  return id;
};
