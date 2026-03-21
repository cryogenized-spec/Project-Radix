import React, { useState, useEffect } from 'react';
import { X, Plus, ScanLine, QrCode, Copy, UserPlus, MessageSquare, Brain } from 'lucide-react';
import { Icon } from '@iconify/react';
import { getRadixContacts, addRadixContact, getWhatsappContacts, addWhatsappContact } from '../lib/db';

export default function ContactListOverlay({ onClose, onSelectRadix, onSelectWhatsapp, myPeerId }: { onClose: () => void, onSelectRadix: (contact: any) => void, onSelectWhatsapp: (contact: any) => void, myPeerId: string }) {
  const [activeTab, setActiveTab] = useState<'radix' | 'whatsapp'>('radix');
  const [radixContacts, setRadixContacts] = useState<any[]>([]);
  const [whatsappContacts, setWhatsappContacts] = useState<any[]>([]);
  const [showAddRadix, setShowAddRadix] = useState(false);
  const [newRadixName, setNewRadixName] = useState('');
  const [newRadixKey, setNewRadixKey] = useState('');
  const [showAddWhatsapp, setShowAddWhatsapp] = useState(false);
  const [newWhatsappName, setNewWhatsappName] = useState('');
  const [newWhatsappNumber, setNewWhatsappNumber] = useState('');

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    setRadixContacts(await getRadixContacts());
    setWhatsappContacts(await getWhatsappContacts());
  };

  const handleAddRadix = async () => {
    if (!newRadixName.trim() || !newRadixKey.trim()) return;
    await addRadixContact({
      name: newRadixName,
      publicKey: newRadixKey,
      dateAdded: Date.now()
    });
    setNewRadixName('');
    setNewRadixKey('');
    setShowAddRadix(false);
    loadContacts();
  };

  const handleAddWhatsappOS = async () => {
    try {
      // Check if running in an iframe (AI Studio preview)
      let isIframe = false;
      try {
        isIframe = window.self !== window.top;
      } catch (e) {
        isIframe = true;
      }

      if (isIframe) {
        console.warn("Contacts API cannot be used in an iframe. Falling back to manual entry.");
        setShowAddWhatsapp(true);
        return;
      }

      if ('contacts' in navigator && 'ContactsManager' in window) {
        const props = ['name', 'tel'];
        const opts = { multiple: false };
        const contacts = await (navigator as any).contacts.select(props, opts);
        if (contacts && contacts.length > 0) {
          const c = contacts[0];
          const name = c.name?.[0] || 'Unknown';
          const tel = c.tel?.[0] || '';
          if (tel) {
            await addWhatsappContact({
              name,
              phoneNumber: tel.replace(/[^0-9+]/g, ''),
              dateAdded: Date.now()
            });
            loadContacts();
          }
        }
      } else {
        setShowAddWhatsapp(true);
      }
    } catch (ex: any) {
      if (ex.name === 'SecurityError' || ex.message?.includes('top frame')) {
         console.warn("Contacts API blocked. Falling back to manual entry.");
      } else {
         console.error(ex);
      }
      setShowAddWhatsapp(true);
    }
  };

  const handleAddWhatsappManual = async () => {
    if (!newWhatsappName.trim() || !newWhatsappNumber.trim()) return;
    await addWhatsappContact({
      name: newWhatsappName,
      phoneNumber: newWhatsappNumber.replace(/[^0-9+]/g, ''),
      dateAdded: Date.now()
    });
    setNewWhatsappName('');
    setNewWhatsappNumber('');
    setShowAddWhatsapp(false);
    loadContacts();
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[var(--bg-color)] border border-[var(--border)] rounded-2xl p-6 space-y-4 animate-in zoom-in-95 h-[80vh] flex flex-col">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold uppercase tracking-widest text-[var(--accent)]">Contacts</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <div className="flex space-x-2 border-b border-[var(--border)] pb-2">
          <button 
            onClick={() => setActiveTab('radix')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${activeTab === 'radix' ? 'bg-[var(--accent)] text-black' : 'text-[var(--text-muted)] hover:bg-[var(--panel-bg)]'}`}
          >
            Radix P2P
          </button>
          <button 
            onClick={() => setActiveTab('whatsapp')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center ${activeTab === 'whatsapp' ? 'bg-[#25D366] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--panel-bg)]'}`}
          >
            <Icon icon="logos:whatsapp-icon" className="mr-2" /> WhatsApp
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {activeTab === 'radix' && (
            <>
              <div className="p-4 bg-[var(--panel-bg)] rounded-xl border border-[var(--border)] space-y-2 mb-4">
                  <div className="text-xs font-bold uppercase text-[var(--text-muted)]">My Connection ID</div>
                  <div className="flex items-center space-x-2">
                      <code className="flex-1 p-2 bg-[var(--bg-color)] rounded border border-[var(--border)] text-xs font-mono truncate select-all">
                          {myPeerId || 'Connecting...'}
                      </code>
                      <button 
                          onClick={() => navigator.clipboard.writeText(myPeerId)}
                          className="p-2 hover:bg-[var(--bg-color)] rounded border border-[var(--border)]"
                          title="Copy ID"
                      >
                          <Copy size={16} />
                      </button>
                  </div>
              </div>

              {showAddRadix ? (
                <div className="p-4 bg-[var(--panel-bg)] rounded-xl border border-[var(--border)] space-y-3">
                  <input 
                    type="text" 
                    placeholder="Contact Name" 
                    value={newRadixName}
                    onChange={e => setNewRadixName(e.target.value)}
                    className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-lg p-2 text-sm focus:border-[var(--accent)] outline-none"
                  />
                  <input 
                    type="text" 
                    placeholder="Public Key" 
                    value={newRadixKey}
                    onChange={e => setNewRadixKey(e.target.value)}
                    className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-lg p-2 text-sm focus:border-[var(--accent)] outline-none font-mono"
                  />
                  <div className="flex space-x-2">
                    <button onClick={handleAddRadix} className="flex-1 py-2 bg-[var(--accent)] text-black rounded-lg text-xs font-bold uppercase">Save</button>
                    <button onClick={() => setShowAddRadix(false)} className="flex-1 py-2 bg-[var(--bg-color)] border border-[var(--border)] rounded-lg text-xs font-bold uppercase">Cancel</button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => setShowAddRadix(true)}
                  className="w-full p-3 border border-dashed border-[var(--border)] rounded-xl hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-xs flex items-center justify-center"
                >
                  <UserPlus size={16} className="mr-2" /> Add Radix Contact
                </button>
              )}

              {radixContacts.map(c => (
                <div key={c.id} onClick={() => onSelectRadix(c)} className="p-3 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl flex items-center justify-between cursor-pointer hover:border-[var(--accent)] transition-colors">
                  <div>
                    <div className="font-bold text-sm">{c.name}</div>
                    <div className="text-[10px] text-[var(--text-muted)] font-mono truncate w-48">{c.publicKey}</div>
                  </div>
                  <MessageSquare size={16} className="text-[var(--text-muted)]" />
                </div>
              ))}
            </>
          )}

          {activeTab === 'whatsapp' && (
            <>
              {showAddWhatsapp ? (
                <div className="p-4 bg-[var(--panel-bg)] rounded-xl border border-[var(--border)] space-y-3 mb-4">
                  <input 
                    type="text" 
                    placeholder="Contact Name" 
                    value={newWhatsappName}
                    onChange={e => setNewWhatsappName(e.target.value)}
                    className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-lg p-2 text-sm focus:border-[#25D366] outline-none"
                  />
                  <input 
                    type="tel" 
                    placeholder="Phone Number (e.g. +1234567890)" 
                    value={newWhatsappNumber}
                    onChange={e => setNewWhatsappNumber(e.target.value)}
                    className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-lg p-2 text-sm focus:border-[#25D366] outline-none font-mono"
                  />
                  <div className="flex space-x-2">
                    <button onClick={handleAddWhatsappManual} className="flex-1 py-2 bg-[#25D366] text-white rounded-lg text-xs font-bold uppercase">Save</button>
                    <button onClick={() => setShowAddWhatsapp(false)} className="flex-1 py-2 bg-[var(--bg-color)] border border-[var(--border)] rounded-lg text-xs font-bold uppercase">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex space-x-2 mb-4">
                  <button 
                    onClick={handleAddWhatsappOS}
                    className="flex-1 p-3 border border-dashed border-[#25D366]/50 rounded-xl hover:border-[#25D366] hover:text-[#25D366] transition-colors text-xs flex items-center justify-center"
                  >
                    <UserPlus size={16} className="mr-2" /> Import from OS
                  </button>
                  <button 
                    onClick={() => setShowAddWhatsapp(true)}
                    className="flex-1 p-3 border border-dashed border-[var(--border)] rounded-xl hover:border-[var(--text-main)] transition-colors text-xs flex items-center justify-center"
                  >
                    <Plus size={16} className="mr-2" /> Manual Entry
                  </button>
                </div>
              )}

              {whatsappContacts.map(c => (
                <div key={c.id} onClick={() => onSelectWhatsapp(c)} className="p-3 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl flex items-center justify-between cursor-pointer hover:border-[#25D366] transition-colors">
                  <div>
                    <div className="font-bold text-sm">{c.name}</div>
                    <div className="text-[10px] text-[var(--text-muted)] font-mono">{c.phoneNumber}</div>
                  </div>
                  <Icon icon="logos:whatsapp-icon" width="20" height="20" />
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
