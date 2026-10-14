# Manajemen Proyek — Gantt Chart

Aplikasi manajemen proyek berbasis **Gantt Chart** yang dibangun dengan **React + TypeScript + Vite**. Seluruh data tersimpan di `localStorage` browser (tanpa server) dan datang dengan **data contoh (seed)** siap pakai.

## Fitur

1. **Task Management** — tambah/edit/hapus tugas, durasi dalam **hari kerja**, tanggal mulai, prioritas (**Low / Medium / High**), warna indikator bar, serta **sub-tugas (parent-child)** dengan bar ringkasan otomatis.
2. **Predecessors & Timeline** — hubungan antar tugas **Finish-to-Start (FS)** dan **Start-to-Start (SS)** beserta **jeda hari (lag)**, penjadwalan otomatis, dan tampilan Gantt Chart interaktif: bar tugas, **panah dependensi**, **drag untuk memindah bar** dan **resize tepi bar untuk mengubah durasi**, zoom Hari/Minggu/Bulan, penanda hari ini, serta bayangan akhir pekan/hari libur.
3. **Resource Management** — pendaftaran anggota tim (nama, email, peran, gaji), **alokasi anggota ke tugas**, beban kerja (hari kerja), tarif harian, dan estimasi biaya.
4. **Kalender Proyek** — pengaturan **akhir pekan** (mis. Sabtu-Minggu atau Jumat-Sabtu) dan **hari libur khusus**, lengkap dengan pratinjau kalender bulanan. Semua durasi hanya menghitung **hari kerja**.
5. **Analisis Proyek** — **Critical Path (CPM)** dengan tabel ES/EF/LS/LF/Float + highlight jalur kritis, dan **diagram PERT** berisi node aktivitas beserta panah FS/SS + lag.

Fitur pendukung: ekspor/impor data proyek (JSON), pencarian tugas, collapse/expand sub-tugas, dan reset data contoh.

## Cara Install & Menjalankan

Prasyarat: **Node.js 20+** dan **npm**.

```bash
# 1. install dependensi
npm install

# 2. jalankan server development (Vite) buka http://localhost:5173
npm run dev
```

### Skrip lainnya

```bash
npm run typecheck   # pemeriksaan TypeScript (tsc --noEmit)
npm test            # menjalankan seluruh test (Vitest)
npm run build       # build produksi ke dist/
npm run preview     # pratinjau hasil build
```

## Struktur Proyek

```
index.html               # entry HTML Vite
vite.config.ts           # konfigurasi Vite + Vitest
tsconfig.json            # konfigurasi TypeScript (strict)
src/
  main.tsx               # mount React
  App.tsx                # shell: tab, modal, impor/ekspor/reset
  index.css              # tema UI (responsif)
  types.ts               # tipe domain + prioritas/roles
  lib/
    calendar.ts          # util tanggal & hari kerja (weekend + holiday)
    scheduler.ts         # CPM: forward/backward pass, rollup, jalur kritis
    seed.ts              # data contoh (seed)
    store.ts             # state reaktif + persistensi localStorage
    tree.ts              # helper hierarki parent-child
    rows.ts              # baris tampil (pohon, pencarian, collapse)
    metrics.ts           # beban kerja & estimasi biaya
    format.ts            # format rupiah/avatar/warna
    toast.ts             # notifikasi toast
  components/
    TopBar.tsx  StatsBar.tsx
    TasksTab.tsx  TaskModal.tsx        # daftar tugas + modal CRUD
    GanttTab.tsx                       # Gantt (bar, panah, drag/resize)
    ResourcesTab.tsx  MemberModal.tsx  # anggota & alokasi
    CalendarTab.tsx                    # weekend, holiday, pratinjau bulan
    AnalysisTab.tsx  PertDiagram.tsx   # CPM & PERT
  *.test.ts(x)           # unit test + smoke test (Vitest + jsdom)
```

## Penyimpanan Data

- Semua perubahan otomatis tersimpan di `localStorage` dengan kunci `freebuff.pm.gantt.react.v1`.
- Saat pertama dibuka (atau setelah **Reset**), aplikasi memuat **data contoh** proyek 19 tugas, 5 anggota, weekend Sabtu-Minggu, dan 2 hari libur khusus.
- **Ekspor** mengunduh seluruh data sebagai JSON; **Impor** memuatnya kembali (divalidasi & dinormalisasi).

## Screenshot Aplikasi

### 1. Dashboard dan Manajemen Tugas

![Dashboard Aplikasi](projekarsi\screenshots\Cuplikan layar 2026-10-14 233655.png)

### 2. Gantt Chart

![Gantt Chart Aplikasi](projekarsi\screenshots\Cuplikan layar 2026-10-14 233715.png)

## Teknologi

- [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org) (strict)
- [Vite 7](https://vite.dev) untuk dev server & build
- [Vitest](https://vitest.dev) + Testing Library (+ jsdom) untuk pengujian
- Tanpa dependensi UI lain — CSS murni

## Lisensi

MIT
