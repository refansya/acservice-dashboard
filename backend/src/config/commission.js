// Persentase komisi helper berdasarkan jenis pekerjaan.
// Total pool komisi = jobCost * rate, dibagi rata ke semua helper pada order tsb.
const COMMISSION_RATES = {
  MAINTENANCE: 10,
  INSTALASI: 15,
  SERVICE: 15,
};

function getCommissionRate(jobType) {
  return COMMISSION_RATES[jobType] ?? 0;
}

module.exports = { COMMISSION_RATES, getCommissionRate };
