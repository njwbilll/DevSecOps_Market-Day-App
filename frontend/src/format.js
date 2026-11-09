export const rupiah = (n) => 'Rp' + Number(n || 0).toLocaleString('id-ID');

export const dateTime = (iso) =>
  new Date(iso).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export const todayWIB = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

export const addDays = (day, n) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

export const dayLabel = (day) =>
  new Date(`${day}T00:00:00+07:00`).toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    timeZone: 'Asia/Jakarta',
  });

export const homeFor = (role) =>
  ({ MAHASISWA: '/app', MERCHANT: '/merchant', ADMIN: '/admin' })[role] || '/masuk';
