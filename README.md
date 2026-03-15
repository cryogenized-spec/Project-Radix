<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Project Radix

**Sovereign • Local-First • Peer-to-Peer Communication & Productivity**

A radical, mathematically rigorous decentralized software ecosystem built as a high-performance Progressive Web App (PWA). Radix eliminates centralized servers for messaging, data storage, and AI processing, giving users complete data sovereignty, uncompromising privacy, and sub-Telegram X resource efficiency.

## Table of Contents
- [Overview](#overview)
- [Core Architecture](#core-architecture)
- [Network Topology](#network-topology)
- [Data Persistence](#data-persistence)
- [Security & Sovereign Identity](#security--sovereign-identity)
- [Integrated Artificial Intelligence](#integrated-artificial-intelligence)
- [Media & File Transfer](#media--file-transfer)
- [Productivity Ecosystem](#productivity-ecosystem)
- [License](#license)
- [Works Cited](#works-cited)

## Overview

The prevailing paradigm of contemporary digital communication has been dominated by the client-server model. User data, cryptographic keys, media, and logic live in centralized proprietary clouds. While convenient, this creates profound vulnerabilities in privacy, sovereignty, and resilience.

**Project Radix** is a complete departure: a strict **Local-First** and **Peer-to-Peer (P2P)** ecosystem that removes all centralized intermediaries for communication, storage, and AI.

This README serves as the official technical blueprint and repository documentation.

## Core Architecture

Radix is engineered for maximum ubiquity, censorship resistance, and minimal device overhead.

- **Progressive Web App (PWA)**: Runs everywhere (desktop, tablet, mobile) without app-store gatekeeping. Leverages Service Workers for robust offline support and background sync.
- **Build Stack**:
  - **Vite** – lightning-fast builds and HMR
  - **React** – functional components with aggressive memoization for 60 fps performance
  - **TypeScript** – strict typing for predictable P2P payloads

**Performance Target**: Smaller memory/storage footprint than Telegram X, achieved through aggressive tree-shaking, zero unnecessary dependencies, and maximum use of native browser APIs.

### Tech Stack Summary

| Component              | Technology          | Rationale |
|------------------------|---------------------|---------|
| Application Framework  | React + Vite        | Modular UI + minimal bundle sizes |
| Language               | TypeScript          | Compile-time validation of decentralized schemas |
| Deployment             | PWA                 | Universal access, offline-first, no app-store restrictions |
| Performance Benchmark  | Sub-Telegram X      | Native Web APIs + aggressive optimization |

## Network Topology: Native Peer-to-Peer

Radix uses **WebRTC** (RTCDataChannel over UDP) for direct, encrypted communication between devices — no servers involved in message routing.

- **Signaling**: Temporary, zero-knowledge use of Google Firestore as an ephemeral bulletin board. SDP offers/answers and ICE candidates are exchanged, then the Firestore document is immediately purged. Firestore never sees any conversation data.
- **Latency**: Reduced to the shortest physical path between peers (far superior to client-server round-trips).

## Data Persistence: Local-First Paradigm

All data lives on the user’s device first. Network sync is opportunistic, not required.

### Hybrid Storage Model

| Layer                  | Technology   | Purpose |
|------------------------|--------------|-------|
| Local State Cache      | IndexedDB    | High-speed configs, keys, UI state |
| Decentralized DB       | OrbitDB (on IPFS) | Chat history, shared workspaces |
| Conflict Resolution    | CRDTs        | Offline edits merge flawlessly |

Data is never stored on any central server.

## Security & Sovereign Identity

No accounts, no phone numbers, no central registry.

- **Identity**: Device-generated asymmetric key pair (Web Crypto API). Public key = User ID. Private key stays encrypted in IndexedDB.
- **End-to-End Encryption**: WebRTC DTLS + SRTP + additional application-level payload encryption.
- **Kinetic Handshake™**: Unique haptic/rhythmic gesture (Morse-like) derived from touchscreen or accelerometer input. Generates a memory-hard Argon2 key for vault decryption and out-of-band MITM protection.

## Integrated Artificial Intelligence

All AI runs with complete user sovereignty.

### Multi-Model + Bring-Your-Own-Key (BYOK)

Supported providers: Anthropic (Claude), OpenAI, xAI (Grok), Google Gemini, DeepSeek, Moonshot.

API keys are stored locally (encrypted via Kinetic Handshake). Requests go directly from the user’s browser to the provider — Radix never sees prompts or responses.

### Agent Personas

- **Ghost Mode**: Invisible in-chat RAG assistant (local context, suggestions, drafting).
- **Channeler**: Autonomous news curator using RSS + Exa neural search for unbiased, personalized briefings.
- **Task & Semantic Tools**: Auto-extracts action items, calendar events, real-time translation, STT.

All processing is local or direct client-to-provider.

## Media & File Transfer

- Automatic client-side optimization: **AVIF** for images, **AV1** for video via WebAssembly (no cloud encoding).
- Direct high-speed P2P file transfer — no rate limits, no middleman scanning.

## Productivity Ecosystem

Unified workspace inside the P2P layer:
- Spatial canvas for notes, chats, and calendar events
- Universal semantic search (local vector embeddings + WebAssembly)
- Themeable, minimalist UI with zero-cost CSS variable switching

## License

**GNU General Public License v3 (GPLv3)**  
Strong copyleft ensures the code, cryptography, and any derivatives remain forever free, open, and auditable. No proprietary forks allowed.

## Works Cited
1. github.com/cryogenized-spec/Project-Radix  
2. Wordlist 2 | PDF - Scribd

---

**Radix** is not an incremental improvement on existing messengers.  
It is the blueprint for the next era of sovereign digital life.

Ready to run locally? Clone the repo, `npm install`, `npm run dev` — and join the decentralized network..



Welcome to true digital freedom.
