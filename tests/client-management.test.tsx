import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClientManagement } from "@/features/clients/views/client-management";

vi.mock("@/features/clients/controllers/client-management.actions", () => ({
  createClientAction: vi.fn(),
  updateClientAction: vi.fn(),
  archiveClientAction: vi.fn(),
  restoreClientAction: vi.fn(),
}));

vi.mock("@/features/identity/views/account-menu", () => ({
  AccountMenu: () => <div />,
}));

const actor = { id: "director", name: "Alex Morgan", initials: "AM", role: "senior_director" as const, teamId: null };
const accountLeads = [{ id: "lead-1", name: "Sophie Turner", initials: "ST" }];

describe("client management", () => {
  it("makes active clients editable while keeping archived clients restorable", () => {
    render(<ClientManagement
      actor={actor}
      accountLeads={accountLeads}
      clients={[
        { id: "client-active", name: "Atlas Automotive", accountLeadId: "lead-1", accountLeadName: "Sophie Turner", isActive: true },
        { id: "client-archived", name: "Former Motors", accountLeadId: null, accountLeadName: null, isActive: false },
      ]}
    />);

    expect(screen.getByRole("heading", { name: "Client management" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Client management" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("Active clients").previousElementSibling?.textContent).toBe("1");
    expect(screen.getByText("Archived clients").previousElementSibling?.textContent).toBe("1");

    const activeClient = screen.getByText("Atlas Automotive").closest("article");
    expect(activeClient).toBeTruthy();
    expect(within(activeClient!).getByRole("button", { name: "Save" })).toBeTruthy();
    expect(within(activeClient!).getByRole("button", { name: "Archive client" })).toBeTruthy();

    const archivedClient = screen.getByText("Former Motors").closest("article");
    expect(archivedClient).toBeTruthy();
    expect(within(archivedClient!).getByRole("button", { name: "Restore client" })).toBeTruthy();
    expect(within(archivedClient!).queryByRole("button", { name: "Archive client" })).toBeNull();
  });
});
