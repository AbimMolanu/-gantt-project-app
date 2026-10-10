/* Data contoh (seed) untuk aplikasi Manajemen Proyek — Gantt Chart */
import type { ProjectState } from '../types'

export function createSeedState(): ProjectState {
  return {
    project: { name: 'Proyek Peluncuran Web Perusahaan' },
    calendar: {
      weekendDays: [0, 6], // 0=Minggu, 6=Sabtu
      holidays: [
        { id: 'h1', date: '2026-11-04', name: 'Hari Libur Khusus' },
        { id: 'h2', date: '2026-12-25', name: 'Hari Natal' },
      ],
    },
    members: [
      { id: 'm1', name: 'Budi Santoso', email: 'budi@perusahaan.com', role: 'Project Manager', salary: 18000000 },
      { id: 'm2', name: 'Siti Aminah', email: 'siti@perusahaan.com', role: 'UI/UX Designer', salary: 13000000 },
      { id: 'm3', name: 'Andi Wijaya', email: 'andi@perusahaan.com', role: 'Frontend Developer', salary: 14000000 },
      { id: 'm4', name: 'Rina Kartika', email: 'rina@perusahaan.com', role: 'Backend Developer', salary: 15000000 },
      { id: 'm5', name: 'Dimas Pratama', email: 'dimas@perusahaan.com', role: 'QA Engineer', salary: 12000000 },
    ],
    tasks: [
      { id: 't1', name: 'Perencanaan Proyek', parentId: null, start: '2026-10-12', duration: 1, priority: 'high', color: '#ea580c', preds: [], members: ['m1'] },
      { id: 't1a', name: 'Definisi Ruang Lingkup', parentId: 't1', start: '2026-10-12', duration: 3, priority: 'high', color: '#ea580c', preds: [], members: ['m1'] },
      { id: 't1b', name: 'Penyusunan Jadwal & Anggaran', parentId: 't1', start: '2026-10-15', duration: 2, priority: 'medium', color: '#2563eb', preds: [{ taskId: 't1a', type: 'FS', lag: 1 }], members: ['m1'] },

      { id: 't2', name: 'Desain Antarmuka', parentId: null, start: '2026-10-20', duration: 1, priority: 'medium', color: '#2563eb', preds: [], members: ['m2'] },
      { id: 't2a', name: 'Wireframe & User Flow', parentId: 't2', start: '2026-10-20', duration: 3, priority: 'medium', color: '#2563eb', preds: [{ taskId: 't1b', type: 'FS', lag: 0 }], members: ['m2'] },
      { id: 't2b', name: 'Desain UI High-Fidelity', parentId: 't2', start: '2026-10-21', duration: 4, priority: 'high', color: '#f59e0b', preds: [{ taskId: 't2a', type: 'SS', lag: 1 }], members: ['m2'] },
      { id: 't2c', name: 'Review & Finalisasi Desain', parentId: 't2', start: '2026-10-27', duration: 2, priority: 'medium', color: '#2563eb', preds: [{ taskId: 't2b', type: 'FS', lag: 0 }], members: ['m2', 'm1'] },

      { id: 't3', name: 'Pengembangan', parentId: null, start: '2026-10-16', duration: 1, priority: 'high', color: '#ea580c', preds: [], members: ['m3', 'm4'] },
      { id: 't3a', name: 'Penyiapan Environment & CI/CD', parentId: 't3', start: '2026-10-16', duration: 2, priority: 'medium', color: '#16a34a', preds: [{ taskId: 't1b', type: 'FS', lag: 0 }], members: ['m4'] },
      { id: 't3b', name: 'Implementasi Halaman Frontend', parentId: 't3', start: '2026-10-29', duration: 5, priority: 'high', color: '#ea580c', preds: [{ taskId: 't2c', type: 'FS', lag: 0 }], members: ['m3'] },
      { id: 't3c', name: 'Pengembangan API & Basis Data', parentId: 't3', start: '2026-10-21', duration: 5, priority: 'high', color: '#8b5cf6', preds: [{ taskId: 't3a', type: 'FS', lag: 0 }], members: ['m4'] },
      { id: 't3d', name: 'Integrasi Frontend – Backend', parentId: 't3', start: '2026-11-05', duration: 3, priority: 'high', color: '#dc2626', preds: [{ taskId: 't3b', type: 'SS', lag: 2 }, { taskId: 't3c', type: 'FS', lag: 0 }], members: ['m3', 'm4'] },

      { id: 't4', name: 'Pengujian & QA', parentId: null, start: '2026-11-10', duration: 1, priority: 'medium', color: '#2563eb', preds: [], members: ['m5'] },
      { id: 't4a', name: 'Uji Fungsional', parentId: 't4', start: '2026-11-10', duration: 3, priority: 'high', color: '#ea580c', preds: [{ taskId: 't3d', type: 'FS', lag: 0 }], members: ['m5'] },
      { id: 't4b', name: 'Uji Regresi & Performa', parentId: 't4', start: '2026-11-13', duration: 2, priority: 'medium', color: '#2563eb', preds: [{ taskId: 't4a', type: 'FS', lag: 0 }], members: ['m5'] },

      { id: 't5', name: 'Peluncuran & Serah Terima', parentId: null, start: '2026-11-17', duration: 1, priority: 'high', color: '#dc2626', preds: [], members: ['m1'] },
      { id: 't5a', name: 'Deployment ke Produksi', parentId: 't5', start: '2026-11-17', duration: 2, priority: 'high', color: '#dc2626', preds: [{ taskId: 't4b', type: 'FS', lag: 0 }], members: ['m4'] },
      { id: 't5b', name: 'Dokumentasi & Serah Terima', parentId: 't5', start: '2026-11-19', duration: 2, priority: 'high', color: '#ea580c', preds: [{ taskId: 't5a', type: 'FS', lag: 1 }], members: ['m1', 'm5'] },
    ],
    ui: {
      tab: 'tasks',
      zoom: 'day',
      collapsed: {},
      search: '',
      critOnly: true,
      showLinks: true,
      calMonth: '',
    },
  }
}
