import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { emailDb, RadixMessage } from './emailDb';
import { getSetting } from './db';
import { useLiveQuery } from 'dexie-react-hooks';

interface EmailContextType {
  sendDispatch: (to: string, subject: string, html: string, attachments?: any[]) => Promise<void>;
  messages: RadixMessage[];
  refreshMessages: () => Promise<void>;
}

const EmailContext = createContext<EmailContextType | undefined>(undefined);

export const RadixEmailProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [smeeUrl, setSmeeUrl] = useState('');
  const [resendApiKey, setResendApiKey] = useState('');

  // Automatically update messages when DB changes
  const messages = useLiveQuery(
    () => emailDb.emails.orderBy('timestamp').reverse().toArray(),
    []
  ) || [];

  const loadSettings = async () => {
    const emailSettings = await getSetting('email_settings') || {};
    setResendApiKey(emailSettings.resendApiKey || '');
    setSmeeUrl(emailSettings.smeeUrl || '');
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Set up Smee.io listener
  useEffect(() => {
    if (!smeeUrl) return;

    const source = new EventSource(smeeUrl);
    
    source.onmessage = async (event) => {
      try {
        const payload = JSON.parse(event.data);
        // Resend webhook payload structure check
        if (payload.type === 'email.received' || payload.type === 'email.delivery_delayed' || payload.type === 'email.bounced' || payload.type === 'email.complained' || payload.type === 'email.delivered' || payload.type === 'email.opened' || payload.type === 'email.clicked') {
            
            const data = payload.data;
            
            if (payload.type === 'email.received') {
                // Inbound Email
                const newMessage: RadixMessage = {
                    threadId: data.id, // Use email ID as thread ID for now
                    status: 'Received',
                    subject: data.subject || 'No Subject',
                    body: data.html || data.text || '',
                    timestamp: new Date(data.created_at || Date.now()).getTime(),
                    metadata: { from: data.from, to: data.to, ...data }
                };
                await emailDb.emails.add(newMessage);
            } else {
                // Status Update for Outbound Email
                const emailId = data.email_id;
                // Find the email in our DB
                const existingEmail = await emailDb.emails.where('threadId').equals(emailId).first();
                if (existingEmail && existingEmail.id) {
                    await emailDb.emails.update(existingEmail.id, {
                        status: payload.type.replace('email.', ''),
                        metadata: { ...existingEmail.metadata, ...data }
                    });
                }
            }
        }
      } catch (e) {
        console.error("Error parsing Smee webhook:", e);
      }
    };

    return () => {
      source.close();
    };
  }, [smeeUrl]);

  const sendDispatch = async (to: string, subject: string, html: string, attachments: any[] = []) => {
    if (!resendApiKey) throw new Error("Resend API Key not configured.");

    // Use fetch directly to avoid SDK issues in browser environment
    const res = await fetch(`${window.location.origin}/radix-dispatch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Radix <onboarding@resend.dev>', // Resend testing domain
        to: to.toLowerCase(),
        subject,
        html,
        attachments
      })
    });

    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to send email via Resend API");
    }

    const data = await res.json();

    // Store in local DB
    const newMessage: RadixMessage = {
      threadId: data.id,
      status: 'Sent',
      subject,
      body: html,
      timestamp: Date.now(),
      metadata: { to, attachments }
    };
    await emailDb.emails.add(newMessage);
  };

  return (
    <EmailContext.Provider value={{ sendDispatch, messages, refreshMessages: async () => {} }}>
      {children}
    </EmailContext.Provider>
  );
};

export const useEmail = () => {
  const context = useContext(EmailContext);
  if (context === undefined) {
    throw new Error('useEmail must be used within a RadixEmailProvider');
  }
  return context;
};
