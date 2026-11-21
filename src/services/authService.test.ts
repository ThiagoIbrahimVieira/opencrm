import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from './authService';

test('AuthService starts logged out, supports demo login and role switching', () => {
  const auth = new AuthService(null);
  assert.equal(auth.getCurrentUser(), null);
  assert.equal(auth.isAdmin(), false);

  const admin = auth.loginDemo('ADMIN');
  assert.equal(admin.role, 'ADMIN');
  assert.equal(auth.isAdmin(), true);

  const seller = auth.switchRole('VENDEDOR');
  assert.equal(seller.role, 'VENDEDOR');
  assert.equal(auth.isAdmin(), false);

  auth.logout();
  assert.equal(auth.getCurrentUser(), null);
});

test('AuthService enforces Admin-only team provisioning and blocks deactivated users', () => {
  const auth = new AuthService(null);
  auth.loginDemo('VENDEDOR');

  assert.throws(
    () =>
      auth.addTeamMember({
        name: 'Lucas Ribeiro',
        email: 'lucas@auracell.com.br',
        role: 'VENDEDOR',
      }),
    /administradores/i
  );

  auth.switchRole('ADMIN');
  const added = auth.addTeamMember({
    name: 'Fernanda Lima',
    email: 'fernanda@auracell.com.br',
    role: 'VENDEDOR',
  });
  assert.equal(added.initials, 'FL');
  assert.equal(added.active, true);

  const toggled = auth.toggleTeamMemberActive(added.id);
  assert.equal(toggled.active, false);

  auth.logout();
  assert.throws(
    () => auth.login({ email: 'fernanda@auracell.com.br', password: 'password123' }),
    /desativado/i
  );
});

test('AuthService registerStore provisions new admin session and storeUnit', async () => {
  const auth = new AuthService(null);
  const user = await auth.registerStore({
    adminName: 'Carlos Silveira',
    adminEmail: 'carlos@padariasilveira.com.br',
    adminPassword: 'supersecret123',
    storeName: 'Padaria Silveira',
    segment: 'Cafeteria & Padaria',
  });

  assert.equal(user.role, 'ADMIN');
  assert.equal(user.name, 'Carlos Silveira');
  assert.equal(user.storeUnit, 'Padaria Silveira');
  assert.equal(auth.getCurrentUser()?.email, 'carlos@padariasilveira.com.br');
  assert.equal(auth.isAdmin(), true);
});

test('AuthService registerSeller provisions seller session awaiting store access', async () => {
  const auth = new AuthService(null);
  const seller = await auth.registerSeller({
    name: 'Juliana Paes',
    email: 'juliana@vendas.com.br',
    password: 'password123',
  });

  assert.equal(seller.role, 'VENDEDOR');
  assert.equal(seller.name, 'Juliana Paes');
  assert.equal(seller.storeUnit, 'Aguardando vínculo');
  assert.equal(auth.getCurrentUser()?.email, 'juliana@vendas.com.br');
  assert.equal(auth.isAdmin(), false);
});
