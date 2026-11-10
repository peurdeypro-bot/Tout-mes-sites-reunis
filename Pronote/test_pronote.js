import { fetchPronoteData } from './pronote-service.js';

const requiredVariables = ['PRONOTE_URL', 'PRONOTE_USERNAME', 'PRONOTE_PASSWORD'];
const credentials = {
  url: process.env.PRONOTE_URL || '',
  username: process.env.PRONOTE_USERNAME || '',
  password: process.env.PRONOTE_PASSWORD || '',
  entProvider: process.env.PRONOTE_ENT || ''
};
requiredVariables.forEach((name) => delete process.env[name]);
delete process.env.PRONOTE_ENT;
const missingVariables = requiredVariables.filter((name) => !credentials[
  name === 'PRONOTE_URL' ? 'url' : name === 'PRONOTE_USERNAME' ? 'username' : 'password'
]);

if (missingVariables.length) {
  console.error(`Variables manquantes : ${missingVariables.join(', ')}`);
  console.error('Définis-les dans le terminal, sans les inscrire dans un fichier du projet.');
  credentials.url = '';
  credentials.username = '';
  credentials.password = '';
  credentials.entProvider = '';
  process.exitCode = 1;
} else {
  try {
    const data = await fetchPronoteData(credentials);
    data.grades.sort((first, second) => Date.parse(second.date) - Date.parse(first.date));
    console.log('Connexion à Pronote réussie.');
    console.log('\nNotes :');
    data.grades.forEach((grade) => console.log(`- ${grade.subject} : ${grade.value}/${grade.outOf}`));
    console.log('\nDevoirs :');
    data.homework.forEach((item) => console.log(`- ${item.subject} · ${item.date ? new Date(item.date).toLocaleDateString('fr-FR') : 'date inconnue'} · ${item.description}`));
    console.log(`\nCours récupérés cette semaine : ${data.lessons.length}`);
  } catch {
    console.error('Connexion ou lecture des données impossible. Vérifie l’adresse, les identifiants et l’accès réseau.');
    process.exitCode = 1;
  } finally {
    credentials.url = '';
    credentials.username = '';
    credentials.password = '';
    credentials.entProvider = '';
  }
}
