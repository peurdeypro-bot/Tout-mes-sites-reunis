import { Client } from 'pronotets';
import * as ent from 'pronotets/ent';

const entProviders = {
  acReunion: ent.acReunion,
  acRennes: ent.acRennes,
  acOrleansTours: ent.acOrleansTours,
  acPoitiers: ent.acPoitiers,
  acReims: ent.acReims,
  atriumSud: ent.atriumSud,
  bordeaux: ent.bordeaux,
  casAgora06: ent.casAgora06,
  casArsene76: ent.casArsene76,
  casArsene76Edu: ent.casArsene76Edu,
  casCybercolleges42Edu: ent.casCybercolleges42Edu,
  casEnt27: ent.casEnt27,
  casKosmos: ent.casKosmos,
  casSeinesaintdenisEdu: ent.casSeinesaintdenisEdu,
  eclatBfc: ent.eclatBfc,
  ecollegeHauteGaronneEdu: ent.ecollegeHauteGaronneEdu,
  ent77: ent.ent77,
  ent94: ent.ent94,
  entAuvergnerhonealpe: ent.entAuvergnerhonealpe,
  entCreuse: ent.entCreuse,
  entCreuseEduconnect: ent.entCreuseEduconnect,
  entEcollege78: ent.entEcollege78,
  entElyco: ent.entElyco,
  entEssonne: ent.entEssonne,
  entHdf: ent.entHdf,
  entMayotte: ent.entMayotte,
  entSomme: ent.entSomme,
  entVar: ent.entVar,
  extranetCollegesSomme: ent.extranetCollegesSomme,
  ileDeFrance: ent.ileDeFrance,
  lNormandie: ent.lNormandie,
  laclasseEduconnect: ent.laclasseEduconnect,
  laclasseLyon: ent.laclasseLyon,
  lyceeconnecteAquitaine: ent.lyceeconnecteAquitaine,
  lyceeconnecteEdu: ent.lyceeconnecteEdu,
  monbureaunumerique: ent.monbureaunumerique,
  neoconnectGuadeloupe: ent.neoconnectGuadeloupe,
  occitanieMontpellier: ent.occitanieMontpellier,
  occitanieMontpellierEduconnect: ent.occitanieMontpellierEduconnect,
  occitanieToulouseEdu: ent.occitanieToulouseEdu,
  parisClasseNumerique: ent.parisClasseNumerique,
  valDeMarne: ent.valDeMarne,
  valDoise: ent.valDoise
};

const asText = (value) => value === undefined || value === null ? '' : String(value);
const asLocalDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const asLocalDateValue = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : asLocalDate(date);
};
const asLocalDateTime = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${asLocalDate(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

export async function fetchPronoteData(credentials, ClientType = Client) {
  let urlText = credentials?.url ?? '';
  let username = credentials?.username ?? '';
  let password = credentials?.password ?? '';
  let entProvider = credentials?.entProvider ?? '';
  if (credentials && typeof credentials === 'object') {
    credentials.url = '';
    credentials.username = '';
    credentials.password = '';
    credentials.entProvider = '';
  }

  let client = null;
  let period = null;
  let grades = [];
  let homework = [];
  let lessons = [];
  let overallAverage = '';

  try {
    const pronoteUrl = new URL(urlText);
    if (pronoteUrl.protocol !== 'https:' || pronoteUrl.username || pronoteUrl.password) {
      throw new Error('Une URL Pronote HTTPS sans identifiants intégrés est requise.');
    }
    if (!username || !password) throw new Error('Identifiant et mot de passe requis.');
    if (entProvider && !Object.hasOwn(entProviders, entProvider)) {
      throw Object.assign(new Error('Fournisseur ENT non reconnu.'), { status: 400 });
    }

    client = new ClientType(pronoteUrl.toString(), username, password, entProvider ? { ent: entProviders[entProvider] } : {});
    username = '';
    password = '';
    entProvider = '';
    urlText = '';
    await client.ready();

    const today = new Date();
    const from = new Date(today);
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - ((from.getDay() + 6) % 7));
    const to = new Date(from);
    to.setDate(to.getDate() + 6);
    to.setHours(23, 59, 59, 999);

    period = await client.currentPeriod();
    grades = period ? await period.grades() : [];
    if (period) {
      try {
        overallAverage = await period.overallAverage();
      } catch {}
    }
    homework = await client.homework(from, to);
    lessons = await client.lessons(from, to);
    const normalizedGrades = grades.map((grade) => ({
      subject: asText(grade.subject?.name) || 'Matière',
      value: asText(grade.grade),
      outOf: asText(grade.outOf || grade.defaultOutOf || '20'),
      date: asLocalDateValue(grade.date)
    }));
    normalizedGrades.sort((first, second) => Date.parse(second.date) - Date.parse(first.date));

    return {
      fetchedAt: new Date().toISOString(),
      studentName: asText(client.info?.name),
      periodName: asText(period?.name),
      overallAverage: overallAverage === '-1' ? '' : asText(overallAverage),
      weekStart: asLocalDate(from),
      weekEnd: asLocalDate(to),
      grades: normalizedGrades,
      homework: homework.map((item) => ({
        subject: asText(item.subject?.name) || 'Matière',
        description: asText(item.description),
        date: asLocalDateValue(item.date),
        done: Boolean(item.done)
      })),
      lessons: lessons.map((lesson) => ({
        subject: asText(lesson.subject?.name) || 'Cours',
        start: asLocalDateTime(lesson.start),
        end: asLocalDateTime(lesson.end),
        teacher: asText(lesson.teacherName),
        classroom: asText(lesson.classroom),
        canceled: Boolean(lesson.canceled)
      }))
    };
  } finally {
    if (client) {
      client.username = '';
      client.password = '';
      client.periods_ = null;
      client.communication = null;
      client.encryption = null;
      client.funcOptions = null;
      client.parametresUtilisateur = null;
      client.info = null;
      client.attributes = {};
    }
    period = null;
    grades = [];
    homework = [];
    lessons = [];
    overallAverage = '';
    urlText = '';
    username = '';
    password = '';
    entProvider = '';
  }
}
