import mysql, { RowDataPacket } from 'mysql2/promise';
import { Patient } from '../types';

export async function fetchTodayPatients(): Promise<Patient[]> {
  const connection = await mysql.createConnection({
    host: process.env.SIMRS_DB_HOST,
    port: Number(process.env.SIMRS_DB_PORT || 3306),
    user: process.env.SIMRS_DB_USER,
    password: process.env.SIMRS_DB_PASSWORD,
    database: process.env.SIMRS_DB_NAME,
  });

  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT a.no_rawat, c.no_peserta, d.kddpjp, e.nm_poli
     FROM reg_periksa AS a
     INNER JOIN pasien AS c ON a.no_rkm_medis = c.no_rkm_medis
     INNER JOIN maping_poli_bpjs AS b ON a.kd_poli = b.kd_poli_rs
     INNER JOIN bridging_sep AS d ON a.no_rawat = d.no_rawat
     INNER JOIN poliklinik AS e ON a.kd_poli = e.kd_poli
     WHERE a.kd_pj = 'BPJ'
       AND a.tgl_registrasi = CURDATE()
       AND a.status_lanjut = 'Ralan'
       AND c.no_peserta <> ''
     GROUP BY a.kd_poli
    `
  );

  await connection.end();

  return (rows as RowDataPacket[]).map((r) => ({
    visitNumber: r.no_rawat,
    bpjsNumber: r.no_peserta,
    doctorCode: r.kddpjp,
    clinicName: r.nm_poli,
  }));
} 