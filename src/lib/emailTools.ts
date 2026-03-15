import { Type, FunctionDeclaration } from "@google/genai";
import { emailDb, RadixMessage } from './emailDb';
import { getSetting } from './db';

// Tool Definitions
export const emailDraftTool: FunctionDeclaration = {
  name: "email_draft",
  description: "Draft a new email. Creates a local draft message.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      recipient: { type: Type.STRING, description: "Email address of the recipient." },
      subject: { type: Type.STRING, description: "Subject of the email." },
      body: { type: Type.STRING, description: "HTML or text body of the email." },
      attachments: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING }, 
        description: "List of file paths to attach (optional)." 
      }
    },
    required: ["recipient", "subject", "body"]
  }
};

export const emailSendTool: FunctionDeclaration = {
  name: "email_send",
  description: "Send a drafted email immediately.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      draftId: { type: Type.NUMBER, description: "The numeric ID of the draft to send." }
    },
    required: ["draftId"]
  }
};

export const emailSendDirectTool: FunctionDeclaration = {
  name: "email_send_direct",
  description: "Draft and send an email immediately in one step. Use this if you haven't created a draft yet but the user wants to send an email.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      recipient: { type: Type.STRING, description: "Email address of the recipient." },
      subject: { type: Type.STRING, description: "Subject of the email." },
      body: { type: Type.STRING, description: "HTML or text body of the email." },
      attachments: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING }, 
        description: "List of file paths to attach (optional)." 
      }
    },
    required: ["recipient", "subject", "body"]
  }
};

export const emailCheckupTool: FunctionDeclaration = {
  name: "email_checkup",
  description: "Check the status of sent emails (delivered, opened).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      threadId: { type: Type.STRING, description: "Specific thread ID to check (optional)." }
    }
  }
};

export const emailReadTool: FunctionDeclaration = {
  name: "email_read",
  description: "Read and summarize new inbound emails.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      limit: { type: Type.NUMBER, description: "Max number of emails to read (default 5)." }
    }
  }
};

export const EMAIL_TOOLS = [emailDraftTool, emailSendTool, emailSendDirectTool, emailCheckupTool, emailReadTool];

// Tool Implementations
export const emailToolsHandler = {
  email_draft: async (args: any) => {
    const { recipient, subject, body, attachments } = args;
    const id = await emailDb.emails.add({
      threadId: `draft-${Date.now()}`,
      status: 'Draft',
      subject,
      body,
      timestamp: Date.now(),
      metadata: { to: recipient, attachments }
    });
    return `Draft created successfully. ID: ${id}. \nTo: ${recipient}\nSubject: ${subject}\n\nAsk the user to confirm sending this draft.`;
  },

  email_send_direct: async (args: any) => {
    const { recipient, subject, body, attachments } = args;
    
    const emailSettings = await getSetting('email_settings');
    const apiKey = emailSettings?.resendApiKey;
    
    if (!apiKey) return "Error: Resend API Key is not configured in Settings.";

    try {
      const payload: any = {
        from: 'Radix <onboarding@resend.dev>',
        to: recipient.toLowerCase(),
        subject: subject,
        html: body
      };

      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        payload.attachments = attachments;
      }

      const res = await fetch(`${window.location.origin}/radix-dispatch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
          const errorData = await res.json();
          throw new Error(`Resend API Error (${res.status}): ${errorData.message || JSON.stringify(errorData)}`);
      }

      const data = await res.json();

      await emailDb.emails.add({
        threadId: data.id,
        status: 'Sent',
        subject,
        body,
        timestamp: Date.now(),
        metadata: { to: recipient, attachments }
      });

      return `Email dispatched successfully! ID: ${data.id}`;
    } catch (e: any) {
      return `Failed to dispatch email: ${e.message}. Please inform the user of the exact error message.`;
    }
  },

  email_send: async (args: any) => {
    const { draftId } = args;
    const draft = await emailDb.emails.get(Number(draftId));
    
    if (!draft) return `Error: Draft with ID ${draftId} not found.`;
    if (draft.status === 'Sent') return `Error: Draft ${draftId} was already sent.`;

    const emailSettings = await getSetting('email_settings');
    const apiKey = emailSettings?.resendApiKey;
    
    if (!apiKey) return "Error: Resend API Key is not configured in Settings.";

    try {
      const payload: any = {
        from: 'Radix <onboarding@resend.dev>',
        to: draft.metadata?.to?.toLowerCase(),
        subject: draft.subject,
        html: draft.body
      };

      if (draft.metadata?.attachments && Array.isArray(draft.metadata.attachments) && draft.metadata.attachments.length > 0) {
        payload.attachments = draft.metadata.attachments;
      }

      // Use fetch directly to avoid SDK issues in browser environment
      const res = await fetch(`${window.location.origin}/radix-dispatch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
          const errorData = await res.json();
          throw new Error(`Resend API Error (${res.status}): ${errorData.message || JSON.stringify(errorData)}`);
      }

      const data = await res.json();

      // Update Draft
      await emailDb.emails.update(Number(draftId), {
        status: 'Sent',
        threadId: data.id,
        timestamp: Date.now()
      });

      return `Email dispatched successfully! ID: ${data.id}`;
    } catch (e: any) {
      return `Failed to dispatch email: ${e.message}. Please inform the user of the exact error message.`;
    }
  },

  email_checkup: async (args: any) => {
    const { threadId } = args;
    let query = emailDb.emails.where('status').equals('Sent');
    
    if (threadId) {
      // If threadId is provided, we might need to look it up specifically
      // But for now let's just return the latest sent emails
    }

    const sentEmails = await query.reverse().limit(5).toArray();
    
    if (sentEmails.length === 0) return "No recent sent emails found.";

    const statusReport = sentEmails.map(e => {
      // In a real app, we would check the webhook events table for 'delivered' or 'opened' events linked to this email
      // For now, we just report the sent timestamp
      return `- ${e.subject} (to ${e.metadata?.to}): Sent at ${new Date(e.timestamp).toLocaleString()}`;
    }).join('\n');

    return `Recent Dispatch Status:\n${statusReport}`;
  },

  email_read: async (args: any) => {
    const limit = args.limit || 5;
    const unread = await emailDb.emails
      .where('status').equals('Received')
      .reverse()
      .limit(limit)
      .toArray();

    if (unread.length === 0) return "No new unread emails found.";

    const summaries = unread.map(e => {
      return `From: ${e.metadata?.from || 'Unknown'}\nSubject: ${e.subject}\nBody Preview: ${e.body.substring(0, 200)}...\n`;
    }).join('\n---\n');

    return `Found ${unread.length} new emails:\n\n${summaries}`;
  }
};
