import React, { useState, useEffect, useRef } from 'react';
import { TerminalSquare, Usb, Settings2, Play, Square, Trash2, Download, Cpu, Radio, Box, Layers, ScanBarcode } from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
// import RadixWorkbench from './RadixWorkbench';
import ScannerTool from './ScannerTool';

interface SerialPortInfo {
  port: any;
  info: any;
}

const TABS = [
  { id: 'serial', label: 'Serial Terminal', icon: <TerminalSquare size={16} /> },
  // { id: 'workbench', label: 'RADIX Workbench', icon: <Layers size={16} /> },
  { id: 'scanner', label: 'Scanner', icon: <ScanBarcode size={16} /> },
];

export default function Tools() {
  const [activeTab, setActiveTab] = useState<'serial' | 'scanner'>('serial');
  const [tabOrder, setTabOrder] = useState(['serial', 'scanner']);
  const [isSupported, setIsSupported] = useState(false);
  const [port, setPort] = useState<any | null>(null);
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState<{ timestamp: number; text: string; type: 'tx' | 'rx' | 'info' | 'error' }[]>([]);
  const [inputCommand, setInputCommand] = useState('');
  const [preset, setPreset] = useState<'custom' | '3dprinter' | 'arduino' | 'baofeng'>('custom');
  
  const readerRef = useRef<any>(null);
  const writerRef = useRef<any>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ('serial' in navigator) {
      setIsSupported(true);
    }
    
    // Cleanup on unmount
    return () => {
      if (port && isConnected) {
        handleDisconnect();
      }
    };
  }, [port, isConnected]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const addLog = (text: string, type: 'tx' | 'rx' | 'info' | 'error') => {
    setLogs(prev => [...prev, { timestamp: Date.now(), text, type }]);
  };

  const handleConnect = async () => {
    try {
      // @ts-ignore
      const selectedPort = await navigator.serial.requestPort();
      await selectedPort.open({ baudRate });
      
      setPort(selectedPort);
      setIsConnected(true);
      addLog(`Connected to port at ${baudRate} baud.`, 'info');
      
      // Start reading
      readLoop(selectedPort);
    } catch (err: any) {
      console.error('Serial connection failed:', err);
      addLog(`Connection failed: ${err.message}`, 'error');
    }
  };

  const readLoop = async (activePort: any) => {
    while (activePort.readable && isConnected) {
      // @ts-ignore
      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = activePort.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      readerRef.current = reader;

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          if (value) {
            addLog(value.trim(), 'rx');
          }
        }
      } catch (error: any) {
        addLog(`Read error: ${error.message}`, 'error');
      } finally {
        reader.releaseLock();
      }
    }
  };

  const handleDisconnect = async () => {
    setIsConnected(false);
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current = null;
      }
      if (writerRef.current) {
        writerRef.current.releaseLock();
        writerRef.current = null;
      }
      if (port) {
        await port.close();
        setPort(null);
        addLog('Disconnected from port.', 'info');
      }
    } catch (err: any) {
      addLog(`Disconnect error: ${err.message}`, 'error');
    }
  };

  const handleSendCommand = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!port || !isConnected || !inputCommand.trim()) return;

    try {
      // @ts-ignore
      const textEncoder = new TextEncoderStream();
      const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
      const writer = textEncoder.writable.getWriter();
      writerRef.current = writer;
      
      const cmd = inputCommand + '\n';
      await writer.write(cmd);
      addLog(inputCommand, 'tx');
      setInputCommand('');
      
      writer.releaseLock();
      writerRef.current = null;
    } catch (err: any) {
      addLog(`Write error: ${err.message}`, 'error');
    }
  };

  const handlePresetChange = (newPreset: 'custom' | '3dprinter' | 'arduino' | 'baofeng') => {
    setPreset(newPreset);
    if (newPreset === '3dprinter') setBaudRate(115200);
    if (newPreset === 'arduino') setBaudRate(9600);
    if (newPreset === 'baofeng') setBaudRate(9600); // CHIRP usually uses 9600
  };

  const handleClearLogs = () => setLogs([]);

  const renderTabs = () => (
    <div className="flex items-center px-4 py-3 border-b border-[var(--border)] bg-[var(--panel-bg)] z-10 overflow-x-auto no-scrollbar">
      <Reorder.Group 
        axis="x" 
        values={tabOrder} 
        onReorder={setTabOrder} 
        className="flex items-center space-x-2 min-w-max"
      >
        {tabOrder.map((tabId) => {
          const tab = TABS.find(t => t.id === tabId);
          if (!tab) return null;
          const isActive = activeTab === tabId;
          
          return (
            <Reorder.Item 
              key={tabId} 
              value={tabId} 
              className="flex items-center"
              whileDrag={{ scale: 1.05, zIndex: 10 }}
              onPointerDown={() => setActiveTab(tabId as any)}
            >
              <div
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-bold text-sm transition-all whitespace-nowrap cursor-pointer ${
                  isActive 
                    ? 'bg-[var(--accent)] text-black' 
                    : 'bg-[var(--panel-bg)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-transparent hover:border-[var(--border)]'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </div>
            </Reorder.Item>
          );
        })}
      </Reorder.Group>
    </div>
  );

  if (!isSupported && activeTab === 'serial') {
    return (
      <div className="flex flex-col h-full w-full bg-[var(--bg-color)]">
        {renderTabs()}
        <div className="p-6 sm:p-8 max-w-4xl mx-auto w-full space-y-8 text-center mt-20">
          <Usb size={48} className="mx-auto text-[var(--text-muted)] mb-4" />
          <h1 className="text-2xl font-bold text-[var(--text-main)]">Web Serial API Not Supported</h1>
          <p className="text-[var(--text-muted)]">
            Your browser does not support the Web Serial API. Please use a Chromium-based browser (Chrome, Edge, Opera) on a desktop operating system to access hardware tools.
          </p>
        </div>
      </div>
    );
  }

  if (activeTab === 'scanner') {
    return (
      <div className="flex flex-col h-full w-full bg-[var(--bg-color)]">
        {renderTabs()}
        <div className="flex-1 overflow-hidden relative">
          <ScannerTool />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[var(--bg-color)]">
      {renderTabs()}
      <div className="flex-1 overflow-y-auto p-6 sm:p-8">
        <div className="max-w-5xl mx-auto w-full space-y-6">

        <div className="flex items-center space-x-3 mb-2 mt-4">
          <TerminalSquare className="text-[var(--accent)]" size={28} />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Hardware Tools</h1>
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          Interface directly with USB-C and USB-A devices (3D Printers, Microcontrollers, SDRs) via the Web Serial API. No drivers required.
        </p>

        {/* CONNECTION PANEL */}
        <section className="bg-[var(--panel-bg)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--text-muted)] mb-4 flex items-center">
            <Settings2 size={16} className="mr-2" />
            Connection Settings
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Device Preset</label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => handlePresetChange('3dprinter')}
                  className={`p-2 rounded-lg text-xs font-bold border flex flex-col items-center justify-center space-y-1 transition-colors ${preset === '3dprinter' ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]' : 'bg-[var(--bg-color)] border-[var(--border)] text-[var(--text-main)] hover:border-[var(--text-muted)]'}`}
                >
                  <Box size={16} />
                  <span>3D Printer</span>
                </button>
                <button 
                  onClick={() => handlePresetChange('arduino')}
                  className={`p-2 rounded-lg text-xs font-bold border flex flex-col items-center justify-center space-y-1 transition-colors ${preset === 'arduino' ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]' : 'bg-[var(--bg-color)] border-[var(--border)] text-[var(--text-main)] hover:border-[var(--text-muted)]'}`}
                >
                  <Cpu size={16} />
                  <span>Arduino</span>
                </button>
                <button 
                  onClick={() => handlePresetChange('baofeng')}
                  className={`p-2 rounded-lg text-xs font-bold border flex flex-col items-center justify-center space-y-1 transition-colors ${preset === 'baofeng' ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]' : 'bg-[var(--bg-color)] border-[var(--border)] text-[var(--text-main)] hover:border-[var(--text-muted)]'}`}
                >
                  <Radio size={16} />
                  <span>Radio (SDR)</span>
                </button>
                <button 
                  onClick={() => handlePresetChange('custom')}
                  className={`p-2 rounded-lg text-xs font-bold border flex flex-col items-center justify-center space-y-1 transition-colors ${preset === 'custom' ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]' : 'bg-[var(--bg-color)] border-[var(--border)] text-[var(--text-main)] hover:border-[var(--text-muted)]'}`}
                >
                  <Settings2 size={16} />
                  <span>Custom</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Baud Rate</label>
              <select 
                value={baudRate}
                onChange={(e) => { setBaudRate(Number(e.target.value)); setPreset('custom'); }}
                disabled={isConnected}
                className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-50"
              >
                <option value={9600}>9600</option>
                <option value={19200}>19200</option>
                <option value={38400}>38400</option>
                <option value={57600}>57600</option>
                <option value={115200}>115200</option>
                <option value={250000}>250000</option>
              </select>
            </div>

            <div className="flex items-end">
              {isConnected ? (
                <button 
                  onClick={handleDisconnect}
                  className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/50 text-red-500 font-bold uppercase tracking-wider hover:bg-red-500/20 transition-colors flex items-center justify-center"
                >
                  <Square size={16} className="mr-2" /> Disconnect
                </button>
              ) : (
                <button 
                  onClick={handleConnect}
                  className="w-full py-3 rounded-xl bg-[var(--accent)] text-black font-bold uppercase tracking-wider hover:opacity-90 transition-opacity flex items-center justify-center shadow-md"
                >
                  <Usb size={18} className="mr-2" /> Connect Device
                </button>
              )}
            </div>
          </div>
        </section>

        {/* TERMINAL */}
        <section className="bg-[var(--panel-bg)] border border-[var(--border)] rounded-2xl p-4 shadow-sm flex flex-col h-[500px]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--text-muted)] flex items-center">
              <TerminalSquare size={16} className="mr-2" />
              Serial Terminal
            </h2>
            <div className="flex space-x-2">
              <button onClick={handleClearLogs} className="p-1.5 rounded-lg bg-[var(--bg-color)] border border-[var(--border)] text-[var(--text-muted)] hover:text-red-500 transition-colors" title="Clear Terminal">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          
          <div className="flex-1 bg-black rounded-xl border border-[var(--border)] p-4 overflow-y-auto font-mono text-xs space-y-1">
            {logs.length === 0 ? (
              <div className="text-gray-600 italic h-full flex items-center justify-center">
                Awaiting connection...
              </div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={`flex ${log.type === 'tx' ? 'text-blue-400' : log.type === 'error' ? 'text-red-500' : log.type === 'info' ? 'text-yellow-400' : 'text-green-400'}`}>
                  <span className="opacity-50 mr-2 shrink-0">[{new Date(log.timestamp).toISOString().split('T')[1].slice(0, -1)}]</span>
                  <span className="shrink-0 mr-2">{log.type === 'tx' ? '->' : log.type === 'rx' ? '<-' : '--'}</span>
                  <span className="break-all whitespace-pre-wrap">{log.text}</span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>

          <form onSubmit={handleSendCommand} className="mt-4 flex space-x-2">
            <input 
              type="text" 
              value={inputCommand}
              onChange={(e) => setInputCommand(e.target.value)}
              disabled={!isConnected}
              placeholder={isConnected ? "Enter command (e.g., G28, M105, AT+RST)..." : "Connect a device to send commands"}
              className="flex-1 bg-[var(--bg-color)] border border-[var(--border)] rounded-xl px-4 py-2 text-sm text-[var(--text-main)] font-mono focus:outline-none focus:border-[var(--accent)] disabled:opacity-50"
            />
            <button 
              type="submit"
              disabled={!isConnected || !inputCommand.trim()}
              className="px-6 py-2 rounded-xl bg-[var(--accent)] text-black font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center"
            >
              <Play size={16} className="mr-2" /> Send
            </button>
          </form>
        </section>

        {/* FIRMWARE FLASHING (Mock UI for now) */}
        <section className="bg-[var(--panel-bg)] border border-[var(--border)] rounded-2xl p-6 shadow-sm mb-8">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--text-muted)] mb-4 flex items-center">
            <Download size={16} className="mr-2" />
            Firmware Flasher
          </h2>
          <p className="text-xs text-[var(--text-muted)] mb-4">
            Select a compiled binary (.bin, .hex) to flash directly to the connected microcontroller. 
            Ensure the device is in bootloader mode if required.
          </p>
          <div className="flex items-center space-x-4">
            <button disabled className="px-4 py-2 rounded-xl bg-[var(--bg-color)] border border-[var(--border)] text-[var(--text-muted)] text-sm font-bold uppercase tracking-wider cursor-not-allowed opacity-50">
              Select Firmware File
            </button>
            <button disabled className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black text-sm font-bold uppercase tracking-wider cursor-not-allowed opacity-50">
              Flash Device
            </button>
          </div>
        </section>

      </div>
    </div>
    </div>
  );
}
