/**
 * Egyptian National ID validator (14 digits).
 *
 * Structure:
 *  [0]      century: 2 = 1900–1999, 3 = 2000+
 *  [1-2]    year of birth (2 digits)
 *  [3-4]    month of birth (01–12)
 *  [5-6]    day of birth  (01–31)
 *  [7-8]    governorate code
 *  [9-12]   sequence number (last digit [12] odd=male, even=female)
 *  [13]     check digit
 */

const VALID_GOVERNORATES = new Set([
  '01','02','03','04','11','12','13','14',
  '15','16','17','18','19','21','22','23',
  '24','25','26','27','28','29','31','32',
  '33','34','35',
]);

export interface NationalIdInfo {
  valid: boolean;
  error?: string;
  birthDate?: Date;
  governorate?: string;
  gender?: 'ذكر' | 'أنثى';
}

const GOVERNORATE_NAMES: Record<string, string> = {
  '01': 'القاهرة',     '02': 'الإسكندرية', '03': 'بورسعيد',
  '04': 'السويس',      '11': 'دمياط',       '12': 'الدقهلية',
  '13': 'الشرقية',     '14': 'القليوبية',   '15': 'كفر الشيخ',
  '16': 'الغربية',     '17': 'المنوفية',    '18': 'البحيرة',
  '19': 'الإسماعيلية', '21': 'الجيزة',      '22': 'بني سويف',
  '23': 'الفيوم',      '24': 'المنيا',      '25': 'أسيوط',
  '26': 'سوهاج',       '27': 'قنا',         '28': 'أسوان',
  '29': 'الأقصر',      '31': 'البحر الأحمر','32': 'الوادي الجديد',
  '33': 'مطروح',       '34': 'شمال سيناء',  '35': 'جنوب سيناء',
};

export function parseEgyptianNationalId(id: string): NationalIdInfo {
  const trimmed = id.trim();

  if (!/^\d{14}$/.test(trimmed)) {
    return { valid: false, error: 'الرقم القومي يجب أن يتكون من 14 رقمًا' };
  }

  const century = trimmed[0];
  if (century !== '2' && century !== '3') {
    return { valid: false, error: 'الرقم الأول يجب أن يكون 2 أو 3' };
  }

  const year  = parseInt(trimmed.slice(1, 3), 10);
  const month = parseInt(trimmed.slice(3, 5), 10);
  const day   = parseInt(trimmed.slice(5, 7), 10);
  const fullYear = (century === '2' ? 1900 : 2000) + year;

  if (month < 1 || month > 12) {
    return { valid: false, error: 'شهر الميلاد غير صحيح (يجب أن يكون بين 01 و12)' };
  }

  const daysInMonth = new Date(fullYear, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return { valid: false, error: `يوم الميلاد غير صحيح (يجب أن يكون بين 01 و${daysInMonth} لهذا الشهر)` };
  }

  const govCode = trimmed.slice(7, 9);
  if (!VALID_GOVERNORATES.has(govCode)) {
    return { valid: false, error: 'كود المحافظة غير صحيح' };
  }

  const sequenceLastDigit = parseInt(trimmed[12], 10);
  const gender: 'ذكر' | 'أنثى' = sequenceLastDigit % 2 !== 0 ? 'ذكر' : 'أنثى';

  return {
    valid: true,
    birthDate: new Date(fullYear, month - 1, day),
    governorate: GOVERNORATE_NAMES[govCode],
    gender,
  };
}
