import dynamic from "next/dynamic";

export const CreateWorkspaceDialog = dynamic(
  () =>
    import("./workspace/CreateWorkspaceDialog").then(
      (mod) => mod.CreateWorkspaceDialog
    ),
  { ssr: false }
);

export const EditWorkspaceDialog = dynamic(
  () =>
    import("./workspace/EditWorkspaceDialog").then(
      (mod) => mod.EditWorkspaceDialog
    ),
  { ssr: false }
);

export const DeleteWorkspaceDialog = dynamic(
  () =>
    import("./workspace/DeleteWorkspaceDialog").then(
      (mod) => mod.DeleteWorkspaceDialog
    ),
  { ssr: false }
);

export const CreateConnectionDialog = dynamic(
  () =>
    import("./connection/CreateConnectionDialog").then(
      (mod) => mod.CreateConnectionDialog
    ),
  { ssr: false }
);

export const EditConnectionDialog = dynamic(
  () =>
    import("./connection/EditConnectionDialog").then(
      (mod) => mod.EditConnectionDialog
    ),
  { ssr: false }
);

export const DeleteConnectionDialog = dynamic(
  () =>
    import("./connection/DeleteConnectionDialog").then(
      (mod) => mod.DeleteConnectionDialog
    ),
  { ssr: false }
);

export const TestConnectionDialog = dynamic(
  () =>
    import("./connection/TestConnectionDialog").then(
      (mod) => mod.TestConnectionDialog
    ),
  { ssr: false }
);
