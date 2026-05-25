import {
  loadInboxStaffDirectory,
  loadInboxThread,
} from "@/server/inbox/inbox-loaders";

import { InboxAiCopilotShell } from "./inbox-ai-copilot-drawer";
import { InboxThreadPanel } from "./inbox-thread-panel";
import { InboxThreadError } from "./inbox-thread-error";

export async function InboxThreadLoader({
  dealershipId,
  conversationId,
  currentStaffUserId,
  canManageAssignments,
}: {
  dealershipId: string;
  conversationId: string;
  currentStaffUserId: string;
  canManageAssignments: boolean;
}) {
  const [threadRes, staffDirectoryRes] = await Promise.all([
    loadInboxThread(dealershipId, conversationId),
    loadInboxStaffDirectory(dealershipId),
  ]);

  if (!threadRes.ok) {
    return <InboxThreadError message={threadRes.error.message} />;
  }

  const thread = threadRes.data;

  const staffDirectory = staffDirectoryRes.ok
    ? staffDirectoryRes.data.map((s) => ({
        id: s.id,
        display_name: s.display_name,
      }))
    : [];

  const assigneeId = thread.assignee?.id ?? null;

  return (
    <InboxAiCopilotShell
      conversationId={thread.conversation.id}
      copilot={thread.ai_copilot}
      hasAssignee={assigneeId != null}
      isCurrentAssignee={assigneeId === currentStaffUserId}
    >
      <InboxThreadPanel
        conversationId={thread.conversation.id}
        customerDisplayName={thread.customer_profile.displayName}
        conversationTitle={thread.conversation.title}
        channel={thread.conversation.channel}
        department={thread.conversation.department}
        status={thread.conversation.status}
        messages={thread.messages}
        assignee={thread.assignee}
        workflowCaption={thread.workflow_caption}
        currentStaffUserId={currentStaffUserId}
        canManageAssignments={canManageAssignments}
        staffDirectory={staffDirectory}
        conversationMetadata={thread.conversation.metadata}
        aiEnabled={thread.conversation.ai_enabled}
        customerEmail={thread.customer_profile.email}
        customerPhoneE164={thread.customer_profile.phoneE164}
      />
    </InboxAiCopilotShell>
  );
}
