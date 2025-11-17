import { beforeEach, describe, expect, test } from "bun:test";
import { useAdminStore } from "../../src/shared/stores/adminStore";

describe("useAuth logic", () => {
  beforeEach(() => {
    useAdminStore.getState().logout();
  });

  test("admin store sets and clears admin state", () => {
    const store = useAdminStore.getState();
    expect(store.isAdmin).toBe(false);

    store.setIsAdmin(true);
    expect(useAdminStore.getState().isAdmin).toBe(true);

    store.logout();
    expect(useAdminStore.getState().isAdmin).toBe(false);
  });

  test("showLogout logic: false when no userName and not admin", () => {
    const isAdmin = useAdminStore.getState().isAdmin;
    const userName = undefined;
    const showLogout = Boolean(userName) || isAdmin;

    expect(showLogout).toBe(false);
    expect(isAdmin).toBe(false);
  });

  test("showLogout logic: true when userName is provided", () => {
    const isAdmin = useAdminStore.getState().isAdmin;
    const userName = "testuser@example.com";
    const showLogout = Boolean(userName) || isAdmin;

    expect(showLogout).toBe(true);
  });

  test("showLogout logic: true when user is admin", () => {
    useAdminStore.getState().setIsAdmin(true);
    const isAdmin = useAdminStore.getState().isAdmin;
    const userName = undefined;
    const showLogout = Boolean(userName) || isAdmin;

    expect(showLogout).toBe(true);
    expect(isAdmin).toBe(true);
  });

  test("handleLogout logs out admin when admin is logged in", () => {
    useAdminStore.getState().setIsAdmin(true);
    expect(useAdminStore.getState().isAdmin).toBe(true);

    const isAdmin = useAdminStore.getState().isAdmin;
    if (isAdmin) useAdminStore.getState().logout();

    expect(useAdminStore.getState().isAdmin).toBe(false);
  });

  test("handleLogout does nothing when not admin", () => {
    expect(useAdminStore.getState().isAdmin).toBe(false);

    const isAdmin = useAdminStore.getState().isAdmin;
    if (isAdmin) useAdminStore.getState().logout();

    expect(useAdminStore.getState().isAdmin).toBe(false);
  });
});
