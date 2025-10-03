import { randomUUID } from 'node:crypto';

const users = new Map();

export function seed(initialUsers = []) {
  if (users.size > 0) {
    return;
  }

  initialUsers.forEach((candidate) => {
    const id = candidate.id || randomUUID();
    users.set(id, {
      id,
      name: candidate.name,
      email: candidate.email,
      createdAt: candidate.createdAt || new Date().toISOString(),
    });
  });
}

export function list() {
  return Array.from(users.values());
}

export function get(id) {
  return users.get(id) || null;
}

export function create({ name, email }) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const user = {
    id,
    name,
    email,
    createdAt: now,
  };
  users.set(id, user);
  return user;
}

export function remove(id) {
  return users.delete(id);
}
