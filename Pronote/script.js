(() => {
  const container = document.getElementById('widgets');
  const editButton = document.getElementById('edit-layout');
  const todayLabel = document.getElementById('today-label');
  const toast = document.getElementById('toast');
  const globalBackgroundButton = document.getElementById('global-background-button');
  const globalBackgroundPanel = document.getElementById('global-background-settings');
  const widgetLibrary = document.getElementById('widget-library');
  const openWidgetLibrary = document.getElementById('open-widget-library');
  const loginDialog = document.getElementById('login-dialog');
  const loginForm = document.getElementById('login-form');
  const loginStatus = document.getElementById('login-status');
  const submitLogin = document.getElementById('submit-login');
  const openLogin = document.getElementById('open-login');
  const disconnectButton = document.getElementById('disconnect');
  const connectionBadge = document.getElementById('connection-badge');
  const pageTitle = document.getElementById('page-title');
  const demoScheduleWeek = document.getElementById('schedule-demo-week');
  const demoScheduleGrid = document.getElementById('schedule-demo-grid');
  const realSchedule = document.getElementById('real-schedule');
  const gradeSummaryLabel = document.getElementById('grade-summary-label');
  const gradeSummaryValue = document.getElementById('grade-summary-value');
  const gradeList = document.getElementById('grade-list');
  const gradesPeriod = document.getElementById('grades-period');
  const scheduleMeta = document.getElementById('schedule-meta');
  const homeworkMeta = document.getElementById('homework-meta');
  const homeworkList = document.getElementById('homework-list');
  const demoGradeMarkup = gradeList.innerHTML;
  const demoHomeworkMarkup = homeworkList.innerHTML;
  const demoGradeLabel = gradeSummaryLabel.textContent;
  const demoGradeValue = gradeSummaryValue.innerHTML;
  const demoPageTitle = pageTitle.textContent;
  const demoGradesPeriod = gradesPeriod.textContent;
  const demoScheduleMeta = scheduleMeta.textContent;
  const demoHomeworkMeta = homeworkMeta.textContent;
  let pronoteData = null;
  const storageKey = 'pronote-dashboard-widget-order';
  const layoutStorageKey = 'pronote-dashboard-layout';
  const addedWidgetsStorageKey = 'pronote-dashboard-added-widgets';
  const appearanceKey = 'pronote-dashboard-appearance';
  const maxImageLength = 150000;
  const optionalWidgetIds = new Set(['grade-trend', 'grade-subject-bars', 'grade-percentage', 'grade-pie']);
  try {
    const savedWidgets = JSON.parse(localStorage.getItem(addedWidgetsStorageKey) || '[]');
    if (Array.isArray(savedWidgets)) savedWidgets.forEach((id) => {
      if (!optionalWidgetIds.has(id)) return;
      const widget = container.querySelector(`.widget[data-widget="${id}"]`);
      if (widget) widget.hidden = false;
    });
  } catch {}
  const widgets = [...container.querySelectorAll('.widget')].filter((widget) => !widget.hidden);
  const layoutDefaults = {
    schedule: { column: 1, row: 1, width: 12, height: 12 },
    grades: { column: 1, row: 14, width: 6, height: 8 },
    homework: { column: 7, row: 14, width: 6, height: 8 },
    agenda: { column: 1, row: 23, width: 6, height: 8 },
    documents: { column: 7, row: 23, width: 6, height: 8 },
    'grade-trend': { column: 1, row: 32, width: 6, height: 8 },
    'grade-subject-bars': { column: 7, row: 32, width: 6, height: 8 },
    'grade-percentage': { column: 1, row: 41, width: 4, height: 7 },
    'grade-pie': { column: 5, row: 41, width: 8, height: 8 }
  };
  let layouts = Object.fromEntries(widgets.map((widget) => [
    widget.dataset.widget,
    { ...layoutDefaults[widget.dataset.widget] }
  ]));
  let appearance = { global: {}, widgets: {} };
  let pointerSession = null;
  let toastTimer;

  todayLabel.textContent = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long'
  }).format(new Date());

  try {
    const savedOrder = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(savedOrder)) savedOrder.forEach((id) => {
      const widget = container.querySelector(`[data-widget="${id}"]`);
      if (widget) container.append(widget);
    });
  } catch {}

  try {
    const savedLayouts = JSON.parse(localStorage.getItem(layoutStorageKey) || '{}');
    if (savedLayouts && typeof savedLayouts === 'object') {
      widgets.forEach((widget) => {
        const saved = savedLayouts[widget.dataset.widget];
        if (!saved || !['column', 'row', 'width', 'height'].every((key) => Number.isInteger(saved[key]))) return;
        const minWidth = widget.dataset.widget === 'schedule' ? 8 : 3;
        const width = Math.min(12, Math.max(minWidth, saved.width));
        layouts[widget.dataset.widget] = {
          column: Math.min(13 - width, Math.max(1, saved.column)),
          row: Math.min(200, Math.max(1, saved.row)),
          width,
          height: Math.min(30, Math.max(4, saved.height))
        };
      });
    }
  } catch {}

  try {
    const savedAppearance = JSON.parse(localStorage.getItem(appearanceKey) || '{}');
    if (savedAppearance && typeof savedAppearance === 'object') {
      appearance = {
        global: savedAppearance.global && typeof savedAppearance.global === 'object' ? savedAppearance.global : {},
        widgets: savedAppearance.widgets && typeof savedAppearance.widgets === 'object' ? savedAppearance.widgets : {}
      };
    }
  } catch {}

  const announce = (message) => {
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2200);
  };

  const formatDate = (value, options = { day: 'numeric', month: 'short' }) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Date inconnue' : new Intl.DateTimeFormat('fr-FR', options).format(date);
  };

  const setConnectionBadge = (message, connected) => {
    const dot = connectionBadge.querySelector('span') || document.createElement('span');
    connectionBadge.replaceChildren(dot, document.createTextNode(message));
    connectionBadge.classList.toggle('is-connected', connected);
  };

  const renderPronoteData = (data) => {
    const grades = Array.isArray(data.grades) ? data.grades : [];
    const homework = Array.isArray(data.homework) ? data.homework : [];
    const lessons = Array.isArray(data.lessons) ? data.lessons : [];

    pageTitle.textContent = data.studentName ? `Bonjour, ${data.studentName}` : 'Bonjour';
    gradeSummaryLabel.textContent = 'Moyenne générale';
    gradeSummaryValue.textContent = data.overallAverage ? `${data.overallAverage} / 20` : 'Non publiée';
    gradesPeriod.textContent = `${data.periodName || 'Période Pronote'} · ${grades.length} note${grades.length === 1 ? '' : 's'}`;
    scheduleMeta.textContent = data.weekStart && data.weekEnd
      ? `Semaine du ${formatDate(data.weekStart, { day: 'numeric', month: 'short' })} au ${formatDate(data.weekEnd, { day: 'numeric', month: 'short' })}`
      : 'Cours Pronote';
    gradeList.replaceChildren();
    gradeList.classList.add('is-live-data');
    grades.forEach((grade) => {
      const row = document.createElement('div');
      const subject = document.createElement('span');
      const date = document.createElement('span');
      const value = document.createElement('span');
      row.className = 'grade-row';
      subject.className = 'subject';
      subject.textContent = grade.subject || 'Matière';
      date.className = 'grade-kind';
      date.textContent = grade.date ? formatDate(grade.date) : '';
      value.className = 'grade-value';
      value.textContent = `${grade.value || '—'} / ${grade.outOf || '20'}`;
      row.append(subject, date, value);
      gradeList.append(row);
    });
    if (!grades.length) gradeList.textContent = 'Aucune note pour cette période.';

    homeworkMeta.textContent = `${homework.length} devoir${homework.length === 1 ? '' : 's'} récupéré${homework.length === 1 ? '' : 's'}`;
    homeworkList.replaceChildren();
    homeworkList.classList.add('is-live-data');
    homework.forEach((item) => {
      const row = document.createElement('div');
      const status = document.createElement('input');
      const copy = document.createElement('span');
      const name = document.createElement('span');
      const subject = document.createElement('span');
      const due = document.createElement('span');
      row.className = 'task';
      status.className = 'task-check';
      status.type = 'checkbox';
      status.checked = item.done;
      status.disabled = true;
      status.setAttribute('aria-label', item.done ? 'Devoir terminé' : 'Devoir à faire');
      copy.className = 'task-copy';
      name.className = 'task-name';
      name.textContent = item.description || 'Devoir sans description';
      subject.className = 'task-subject';
      subject.textContent = item.subject || 'Matière';
      copy.append(name, subject);
      due.className = item.done ? 'due soon' : 'due';
      due.textContent = item.date ? formatDate(item.date, { weekday: 'short', day: 'numeric', month: 'short' }) : 'À venir';
      row.append(status, copy, due);
      homeworkList.append(row);
    });
    if (!homework.length) homeworkList.textContent = 'Aucun devoir pour cette semaine.';

    demoScheduleWeek.hidden = true;
    demoScheduleGrid.hidden = true;
    realSchedule.replaceChildren();
    realSchedule.hidden = false;
    realSchedule.classList.add('is-timetable');
    lessons.sort((first, second) => new Date(first.start) - new Date(second.start));
    const datedLessons = lessons.map((lesson) => ({
      lesson,
      start: new Date(lesson.start),
      end: new Date(lesson.end)
    })).filter(({ start, end }) => !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()));
    const hasWeekendLessons = datedLessons.some(({ start }) => start.getDay() === 0 || start.getDay() === 6);
    const dayCount = hasWeekendLessons ? 7 : 5;
    const visibleLessons = datedLessons.filter(({ start }) => {
      const weekday = (start.getDay() + 6) % 7;
      return weekday < dayCount;
    });

    if (!visibleLessons.length) {
      realSchedule.textContent = 'Aucun cours trouvé cette semaine.';
    } else {
      const weekStart = new Date(`${data.weekStart}T00:00:00`);
      const firstHour = Math.max(0, Math.min(...visibleLessons.map(({ start }) => start.getHours())));
      const lastMinute = Math.max(...visibleLessons.map(({ end }) => end.getHours() * 60 + end.getMinutes()));
      const slotCount = Math.max(2, Math.ceil((lastMinute - firstHour * 60) / 30));
      const daysHeader = document.createElement('div');
      const timeGrid = document.createElement('div');
      daysHeader.className = 'week real-week';
      timeGrid.className = 'time-grid real-time-grid';
      daysHeader.style.gridTemplateColumns = `38px repeat(${dayCount}, minmax(0, 1fr))`;
      timeGrid.style.gridTemplateColumns = `38px repeat(${dayCount}, minmax(0, 1fr))`;
      timeGrid.style.gridTemplateRows = `repeat(${slotCount}, minmax(28px, auto))`;
      daysHeader.append(document.createElement('span'));

      for (let dayIndex = 0; dayIndex < dayCount; dayIndex += 1) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + dayIndex);
        const heading = document.createElement('span');
        heading.className = 'day';
        if (date.toDateString() === new Date().toDateString()) heading.classList.add('today-col');
        heading.textContent = formatDate(date, { weekday: 'short', day: 'numeric' });
        daysHeader.append(heading);
      }

      for (let slot = 0; slot < slotCount; slot += 1) {
        if (slot % 2 !== 0) continue;
        const hourLabel = document.createElement('span');
        hourLabel.className = 'time real-time-label';
        hourLabel.style.gridColumn = '1';
        hourLabel.style.gridRow = `${slot + 1} / span 2`;
        hourLabel.textContent = `${String(firstHour + slot / 2).padStart(2, '0')}h`;
        timeGrid.append(hourLabel);
      }

      visibleLessons.forEach(({ lesson, start, end }) => {
        const dayIndex = (start.getDay() + 6) % 7;
        const startMinutes = start.getHours() * 60 + start.getMinutes();
        const endMinutes = Math.max(startMinutes + 30, end.getHours() * 60 + end.getMinutes());
        const startSlot = Math.max(0, Math.floor((startMinutes - firstHour * 60) / 30));
        const endSlot = Math.max(startSlot + 1, Math.ceil((endMinutes - firstHour * 60) / 30));
        const row = document.createElement('article');
        const time = document.createElement('span');
        const subject = document.createElement('strong');
        const details = document.createElement('span');
        const colorIndex = subjectColorIndex(lesson.subject);
        row.className = `lesson real-lesson real-color-${colorIndex}${lesson.canceled ? ' is-canceled' : ''}`;
        row.style.gridColumn = String(dayIndex + 2);
        row.style.gridRow = `${startSlot + 1} / span ${endSlot - startSlot}`;
        time.className = 'lesson-time';
        time.textContent = `${formatDate(start, { hour: '2-digit', minute: '2-digit' })}–${formatDate(end, { hour: '2-digit', minute: '2-digit' })}`;
        subject.textContent = lesson.subject || 'Cours';
        details.textContent = [lesson.teacher, lesson.classroom, lesson.canceled ? 'Annulé' : ''].filter(Boolean).join(' · ');
        row.append(time, subject, details);
        timeGrid.append(row);
      });
      realSchedule.append(daysHeader, timeGrid);
    }
  };

  const chartColors = ['#426c91', '#b86a3f', '#2f654c', '#8a7198', '#b38b2e', '#6688a1', '#b6748b', '#718b48', '#8a795f'];
  const subjectColorIndex = (subject) => [...String(subject || 'Cours').toLocaleLowerCase('fr-FR')]
    .reduce((sum, character) => sum + character.charCodeAt(0), 0) % chartColors.length;
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const svgElement = (name, attributes = {}) => {
    const element = document.createElementNS(svgNamespace, name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
    return element;
  };
  const scoreOnTwenty = (grade) => {
    const value = Number(String(grade.value || '').replace(',', '.'));
    const outOf = Number(String(grade.outOf || '20').replace(',', '.'));
    return Number.isFinite(value) && Number.isFinite(outOf) && outOf > 0 ? value / outOf * 20 : null;
  };
  const showChartMessage = (body, message) => {
    body.replaceChildren();
    const text = document.createElement('p');
    text.className = 'chart-empty';
    text.textContent = message;
    body.append(text);
  };
  const subjectAverages = (grades) => {
    const subjects = new Map();
    grades.forEach((grade) => {
      const score = scoreOnTwenty(grade);
      if (score === null) return;
      const subject = grade.subject || 'Autre';
      const current = subjects.get(subject) || { total: 0, count: 0 };
      current.total += score;
      current.count += 1;
      subjects.set(subject, current);
    });
    return [...subjects].map(([subject, values]) => ({ subject, average: values.total / values.count, count: values.count }));
  };

  const renderStatistics = () => {
    const bodies = {
      trend: document.getElementById('grade-trend-body'),
      bars: document.getElementById('grade-subject-bars-body'),
      percentage: document.getElementById('grade-percentage-body'),
      pie: document.getElementById('grade-pie-body')
    };
    const allBodies = Object.values(bodies);
    if (!pronoteData) {
      allBodies.forEach((body) => showChartMessage(body, 'Connecte-toi à Pronote pour afficher tes statistiques.'));
      return;
    }

    const grades = Array.isArray(pronoteData.grades) ? pronoteData.grades : [];
    const validGrades = grades.filter((grade) => scoreOnTwenty(grade) !== null);
    if (!validGrades.length) {
      allBodies.forEach((body) => showChartMessage(body, 'Aucune note exploitable pour cette statistique.'));
      return;
    }

    const trendGrades = [...validGrades]
      .sort((first, second) => new Date(first.date || 0) - new Date(second.date || 0))
      .slice(-12);
    if (trendGrades.length < 2) {
      showChartMessage(bodies.trend, 'Il faut au moins deux notes pour tracer une évolution.');
    } else {
      const svg = svgElement('svg', { viewBox: '0 0 420 190', role: 'img', 'aria-label': 'Évolution des notes sur 20' });
      [20, 10, 0].forEach((value) => {
        const y = 18 + (20 - value) * 6.4;
        svg.append(svgElement('line', { x1: 34, y1: y, x2: 410, y2: y, class: 'chart-grid-line' }));
        const label = svgElement('text', { x: 4, y: y + 3, class: 'chart-axis-label' });
        label.textContent = String(value);
        svg.append(label);
      });
      const points = trendGrades.map((grade, index) => {
        const x = trendGrades.length === 1 ? 34 : 38 + index * (360 / (trendGrades.length - 1));
        const y = 18 + (20 - scoreOnTwenty(grade)) * 6.4;
        return { x, y, grade };
      });
      svg.append(svgElement('polyline', {
        points: points.map(({ x, y }) => `${x},${y}`).join(' '),
        fill: 'none', stroke: '#2f654c', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
      }));
      points.forEach(({ x, y, grade }) => {
        svg.append(svgElement('circle', { cx: x, cy: y, r: 4, fill: '#ffffff', stroke: '#2f654c', 'stroke-width': 2 }));
        const dateLabel = svgElement('text', { x, y: 174, class: 'chart-axis-label', 'text-anchor': 'middle' });
        dateLabel.textContent = grade.date ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'numeric' }).format(new Date(`${grade.date}T12:00:00`)) : '';
        svg.append(dateLabel);
      });
      svg.classList.add('chart-svg');
      bodies.trend.replaceChildren(svg);
    }

    const averages = subjectAverages(validGrades).sort((first, second) => second.average - first.average).slice(0, 7);
    if (!averages.length) {
      showChartMessage(bodies.bars, 'Aucune moyenne par matière disponible.');
      showChartMessage(bodies.pie, 'Aucune matière disponible.');
    } else {
      const bars = document.createElement('div');
      bars.className = 'chart-bars';
      averages.forEach((item, index) => {
        const row = document.createElement('div');
        const label = document.createElement('span');
        const track = document.createElement('span');
        const fill = document.createElement('span');
        const value = document.createElement('span');
        row.className = 'chart-bar-row';
        label.className = 'chart-bar-label';
        label.textContent = item.subject;
        track.className = 'chart-bar-track';
        fill.className = 'chart-bar-fill';
        fill.style.width = `${Math.max(0, Math.min(100, item.average / 20 * 100))}%`;
        fill.style.backgroundColor = chartColors[subjectColorIndex(item.subject)];
        track.append(fill);
        value.className = 'chart-bar-value';
        value.textContent = `${item.average.toFixed(1).replace('.', ',')}/20`;
        row.append(label, track, value);
        bars.append(row);
      });
      bodies.bars.replaceChildren(bars);

      const total = averages.reduce((sum, item) => sum + item.count, 0);
      const circumference = 2 * Math.PI * 43;
      let offset = 0;
      const pieSvg = svgElement('svg', { viewBox: '0 0 110 110', role: 'img', 'aria-label': 'Répartition des notes par matière' });
      averages.forEach((item, index) => {
        const segment = item.count / total * circumference;
        pieSvg.append(svgElement('circle', {
          cx: 55, cy: 55, r: 43, fill: 'none', stroke: chartColors[subjectColorIndex(item.subject)], 'stroke-width': 20,
          'stroke-dasharray': `${segment} ${circumference - segment}`, 'stroke-dashoffset': -offset,
          transform: 'rotate(-90 55 55)'
        }));
        offset += segment;
      });
      pieSvg.classList.add('pie-chart');
      const legend = document.createElement('div');
      legend.className = 'pie-legend';
      averages.forEach((item, index) => {
        const row = document.createElement('div');
        const swatch = document.createElement('span');
        const label = document.createElement('span');
        row.className = 'pie-legend-item';
        swatch.className = 'pie-legend-swatch';
        swatch.style.backgroundColor = chartColors[subjectColorIndex(item.subject)];
        label.textContent = `${item.subject} · ${item.count}`;
        row.append(swatch, label);
        legend.append(row);
      });
      const pieLayout = document.createElement('div');
      pieLayout.className = 'pie-layout';
      pieLayout.append(pieSvg, legend);
      bodies.pie.replaceChildren(pieLayout);
    }

    const average = Number(String(pronoteData.overallAverage || '').replace(',', '.'));
    if (!Number.isFinite(average) || average < 0) {
      showChartMessage(bodies.percentage, 'La moyenne générale n’est pas publiée.');
    } else {
      const percentage = Math.max(0, Math.min(100, average / 20 * 100));
      const display = document.createElement('div');
      const value = document.createElement('strong');
      const track = document.createElement('div');
      const fill = document.createElement('div');
      const caption = document.createElement('span');
      display.className = 'percentage-stat';
      value.textContent = `${Math.round(percentage)} %`;
      track.className = 'percentage-track';
      fill.className = 'percentage-fill';
      fill.style.width = `${percentage}%`;
      track.append(fill);
      caption.className = 'percentage-caption';
      caption.textContent = `${average.toString().replace('.', ',')} sur 20`;
      display.append(value, track, caption);
      bodies.percentage.replaceChildren(display);
    }
  };

  const clearPronoteData = () => {
    pronoteData = null;
    pageTitle.textContent = demoPageTitle;
    gradeSummaryLabel.textContent = demoGradeLabel;
    gradeSummaryValue.innerHTML = demoGradeValue;
    gradesPeriod.textContent = demoGradesPeriod;
    scheduleMeta.textContent = demoScheduleMeta;
    gradeList.innerHTML = demoGradeMarkup;
    gradeList.classList.remove('is-live-data');
    homeworkMeta.textContent = demoHomeworkMeta;
    homeworkList.innerHTML = demoHomeworkMarkup;
    homeworkList.classList.remove('is-live-data');
    renderStatistics();
    demoScheduleWeek.hidden = false;
    demoScheduleGrid.hidden = false;
    realSchedule.replaceChildren();
    realSchedule.hidden = true;
    realSchedule.classList.remove('is-timetable');
    setConnectionBadge('Données de démonstration', false);
    openLogin.hidden = false;
    disconnectButton.hidden = true;
    loginForm.reset();
  };

  openLogin.addEventListener('click', () => loginDialog.showModal());
  document.getElementById('close-login').addEventListener('click', () => loginDialog.close());
  document.getElementById('cancel-login').addEventListener('click', () => loginDialog.close());
  loginDialog.addEventListener('close', () => {
    loginForm.reset();
    loginStatus.textContent = '';
    loginStatus.classList.remove('is-error');
  });

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const credentials = {
      url: loginForm.elements.url.value,
      username: loginForm.elements.username.value,
      password: loginForm.elements.password.value,
      entProvider: loginForm.elements.entProvider.value
    };
    let requestBody = JSON.stringify(credentials);
    credentials.url = '';
    credentials.username = '';
    credentials.password = '';
    credentials.entProvider = '';
    loginForm.reset();
    submitLogin.disabled = true;
    loginStatus.classList.remove('is-error');
    loginStatus.textContent = 'Connexion en cours…';

    try {
      const response = await fetch('/api/pronote-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
        cache: 'no-store',
        credentials: 'same-origin'
      });
      requestBody = '';
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Connexion Pronote impossible.');
      pronoteData = result;
      pronoteData.grades.sort((first, second) => Date.parse(second.date) - Date.parse(first.date));
      renderPronoteData(pronoteData);
      renderStatistics();
      setConnectionBadge('Données Pronote · en mémoire', true);
      openLogin.hidden = true;
      disconnectButton.hidden = false;
      loginDialog.close();
      announce('Les données Pronote ont été chargées.');
    } catch (error) {
      loginStatus.textContent = error.message || 'Connexion Pronote impossible.';
      loginStatus.classList.add('is-error');
    } finally {
      requestBody = '';
      loginForm.reset();
      submitLogin.disabled = false;
      credentials.url = '';
      credentials.username = '';
      credentials.password = '';
      credentials.entProvider = '';
    }
  });

  disconnectButton.addEventListener('click', () => {
    clearPronoteData();
    announce('Les données ont été effacées de la page.');
  });
  window.addEventListener('pagehide', clearPronoteData);

  const applyGridLayout = (widget) => {
    const layout = layouts[widget.dataset.widget];
    widget.style.gridColumn = `${layout.column} / span ${layout.width}`;
    widget.style.gridRow = `${layout.row} / span ${layout.height}`;
  };

  const saveLayout = () => {
    try {
      localStorage.setItem(layoutStorageKey, JSON.stringify(layouts));
    } catch {
      announce('La disposition ne peut pas être enregistrée sur cet appareil.');
    }
  };

  const overlaps = (first, second) => {
    const a = layouts[first];
    const b = layouts[second];
    return a.column < b.column + b.width && a.column + a.width > b.column
      && a.row < b.row + b.height && a.row + a.height > b.row;
  };

  const resolveCollisions = (activeId) => {
    const remaining = widgets
      .filter((widget) => widget.dataset.widget !== activeId)
      .sort((first, second) => layouts[first.dataset.widget].row - layouts[second.dataset.widget].row
        || layouts[first.dataset.widget].column - layouts[second.dataset.widget].column);
    const placed = [activeId];

    remaining.forEach((widget) => {
      const id = widget.dataset.widget;
      let collisions = placed.filter((placedId) => overlaps(id, placedId));
      let attempts = 0;
      while (collisions.length && attempts < widgets.length) {
        layouts[id].row = Math.max(...collisions.map((placedId) => {
          const layout = layouts[placedId];
          return layout.row + layout.height;
        }));
        collisions = placed.filter((placedId) => overlaps(id, placedId));
        attempts += 1;
      }
      placed.push(id);
    });
    widgets.forEach(applyGridLayout);
  };

  widgets.forEach(applyGridLayout);

  const saveAppearance = () => {
    try {
      localStorage.setItem(appearanceKey, JSON.stringify(appearance));
    } catch {
      announce('Les réglages ne peuvent pas être enregistrés sur cet appareil.');
    }
  };

  const createField = (labelText, control) => {
    const label = document.createElement('label');
    const caption = document.createElement('span');
    label.className = 'setting-field';
    caption.textContent = labelText;
    label.append(caption, control);
    return label;
  };

  const createImageInput = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.className = 'setting-file';
    return input;
  };

  const createResetButton = (text) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'setting-reset';
    button.textContent = text;
    return button;
  };

  const safeColor = (color) => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color);
  const safeImage = (image) => typeof image === 'string' && /^data:image\/jpeg;base64,[a-z0-9+/]+=*$/i.test(image);

  const applyWidgetAppearance = (widget) => {
    const settings = appearance.widgets[widget.dataset.widget] || {};
    widget.style.backgroundColor = safeColor(settings.color) ? settings.color : '';
    if (safeImage(settings.image)) {
      widget.classList.add('has-background-image');
      widget.style.backgroundImage = `linear-gradient(rgb(255 255 255 / 74%), rgb(255 255 255 / 74%)), url("${settings.image}")`;
    } else {
      widget.classList.remove('has-background-image');
      widget.style.backgroundImage = '';
    }
  };

  const applyGlobalBackground = () => {
    if (safeImage(appearance.global.image)) {
      document.body.style.backgroundImage = `linear-gradient(rgb(244 245 242 / 48%), rgb(244 245 242 / 48%)), url("${appearance.global.image}")`;
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundRepeat = 'no-repeat';
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundAttachment = 'fixed';
    } else {
      document.body.style.backgroundImage = '';
      document.body.style.backgroundPosition = '';
      document.body.style.backgroundRepeat = '';
      document.body.style.backgroundSize = '';
      document.body.style.backgroundAttachment = '';
    }
  };

  const resizeImage = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Impossible de lire cette image.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Ce fichier image ne peut pas être utilisé.'));
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Le traitement de cette image a échoué.'));
          return;
        }

        let scale = Math.min(1, 1200 / Math.max(image.width, image.height));
        for (let attempt = 0; attempt < 8; attempt += 1) {
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL('image/jpeg', Math.max(.45, .78 - attempt * .05));
          if (compressed.length <= maxImageLength) {
            resolve(compressed);
            return;
          }
          scale *= .78;
        }
        reject(new Error('Cette image est trop volumineuse pour être enregistrée.'));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  const bindImageInput = (input, onImageReady) => {
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        announce('Choisis un fichier image.');
        input.value = '';
        return;
      }
      try {
        onImageReady(await resizeImage(file));
        saveAppearance();
        announce('Image de fond mise à jour.');
      } catch (error) {
        announce(error.message);
      }
      input.value = '';
    });
  };

  const settingsPanels = [];
  container.querySelectorAll('.widget').forEach((widget) => {
    const storedSettings = appearance.widgets[widget.dataset.widget];
    const settings = storedSettings && typeof storedSettings === 'object' ? storedSettings : {};
    appearance.widgets[widget.dataset.widget] = settings;
    const button = widget.querySelector('[data-settings-button]');
    const panel = document.createElement('div');
    const colorInput = document.createElement('input');
    const imageInput = createImageInput();
    const resetButton = createResetButton('Réinitialiser le bloc');
    const resizeHandle = document.createElement('button');
    panel.id = `${widget.dataset.widget}-settings`;
    panel.className = 'widget-settings';
    panel.hidden = true;
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-label', `Réglages de ${widget.querySelector('h2').textContent}`);
    colorInput.type = 'color';
    colorInput.className = 'setting-color';
    colorInput.value = safeColor(settings.color) ? settings.color : '#ffffff';
    panel.append(
      createField('Couleur de fond', colorInput),
      createField('Image de fond', imageInput),
      resetButton
    );
    widget.querySelector('.widget-body').before(panel);
    resizeHandle.type = 'button';
    resizeHandle.className = 'widget-resize';
    resizeHandle.setAttribute('aria-label', `Redimensionner ${widget.querySelector('h2').textContent}`);
    resizeHandle.title = 'Redimensionner par cases';
    resizeHandle.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M17 7v10H7M17 12l-5 5M17 3v1M13 3v1M9 3v1M3 17h1M3 13h1M3 9h1"/></svg>';
    widget.append(resizeHandle);
    resizeHandle.addEventListener('keydown', (event) => {
      if (editButton.getAttribute('aria-pressed') !== 'true') return;
      const delta = event.shiftKey ? 2 : 1;
      const layout = layouts[widget.dataset.widget];
      const minWidth = widget.dataset.widget === 'schedule' ? 8 : 3;
      if (event.key === 'ArrowRight') layout.width = Math.min(12, layout.width + delta);
      else if (event.key === 'ArrowLeft') layout.width = Math.max(minWidth, layout.width - delta);
      else if (event.key === 'ArrowDown') layout.height = Math.min(30, layout.height + delta);
      else if (event.key === 'ArrowUp') layout.height = Math.max(4, layout.height - delta);
      else return;
      layout.column = Math.min(layout.column, 13 - layout.width);
      event.preventDefault();
      resolveCollisions(widget.dataset.widget);
      saveLayout();
    });
    button.setAttribute('aria-controls', panel.id);
    settingsPanels.push({ button, panel });
    applyWidgetAppearance(widget);

    colorInput.addEventListener('input', () => {
      settings.color = colorInput.value;
      applyWidgetAppearance(widget);
    });
    colorInput.addEventListener('change', saveAppearance);
    bindImageInput(imageInput, (image) => {
      settings.image = image;
      applyWidgetAppearance(widget);
    });
    resetButton.addEventListener('click', () => {
      delete settings.color;
      delete settings.image;
      colorInput.value = '#ffffff';
      applyWidgetAppearance(widget);
      saveAppearance();
      announce('Réglages du bloc réinitialisés.');
    });

  });

  container.addEventListener('click', (event) => {
    const button = event.target.closest('[data-settings-button]');
    if (!button) return;
    const panel = settingsPanels.find((item) => item.button === button)?.panel;
    if (!panel) return;
    const open = panel.hidden;
    settingsPanels.forEach((item) => {
      item.panel.hidden = true;
      item.button.setAttribute('aria-expanded', 'false');
    });
    globalBackgroundPanel.hidden = true;
    globalBackgroundButton.setAttribute('aria-expanded', 'false');
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  });

  const globalImageInput = createImageInput();
  const globalResetButton = createResetButton('Retirer le fond global');
  globalBackgroundPanel.append(
    createField('Image de fond globale', globalImageInput),
    globalResetButton
  );
  applyGlobalBackground();
  bindImageInput(globalImageInput, (image) => {
    appearance.global.image = image;
    applyGlobalBackground();
  });
  globalResetButton.addEventListener('click', () => {
    delete appearance.global.image;
    applyGlobalBackground();
    saveAppearance();
    announce('Fond global retiré.');
  });

  globalBackgroundButton.addEventListener('click', () => {
    const open = globalBackgroundPanel.hidden;
    settingsPanels.forEach((item) => {
      item.panel.hidden = true;
      item.button.setAttribute('aria-expanded', 'false');
    });
    globalBackgroundPanel.hidden = !open;
    globalBackgroundButton.setAttribute('aria-expanded', String(open));
  });

  document.getElementById('close-widget-library').addEventListener('click', () => widgetLibrary.close());
  openWidgetLibrary.addEventListener('click', () => widgetLibrary.showModal());
  widgetLibrary.addEventListener('click', (event) => {
    const option = event.target.closest('[data-add-widget]');
    if (!option) return;
    const id = option.dataset.addWidget;
    const widget = container.querySelector(`.widget[data-widget="${id}"]`);
    if (!optionalWidgetIds.has(id) || !widget) return;
    if (widgets.includes(widget)) {
      widgetLibrary.close();
      announce('Ce widget est déjà affiché.');
      return;
    }
    widget.hidden = false;
    widgets.push(widget);
    layouts[id] = { ...layoutDefaults[id] };
    resolveCollisions(id);
    saveLayout();
    try {
      localStorage.setItem(addedWidgetsStorageKey, JSON.stringify(
        widgets.map((item) => item.dataset.widget).filter((widgetId) => optionalWidgetIds.has(widgetId))
      ));
    } catch {
      announce('Le widget est ajouté, mais ne peut pas être mémorisé sur cet appareil.');
    }
    renderStatistics();
    widgetLibrary.close();
    announce('Widget ajouté à ton tableau de bord.');
  });

  document.getElementById('google-connect').addEventListener('click', () => {
    announce('La connexion Google nécessite une configuration OAuth côté serveur.');
  });

  editButton.addEventListener('click', () => {
    const editing = editButton.getAttribute('aria-pressed') !== 'true';
    editButton.setAttribute('aria-pressed', String(editing));
    container.classList.toggle('is-editing', editing);
    const message = window.matchMedia('(max-width: 680px)').matches
      ? 'Les fenêtres restent empilées sur petit écran.'
      : 'Glisse un en-tête pour déplacer une fenêtre. Tire son coin pour changer sa taille.';
    announce(editing ? message : 'Disposition enregistrée.');
  });

  container.addEventListener('pointerdown', (event) => {
    if (editButton.getAttribute('aria-pressed') !== 'true' || window.matchMedia('(max-width: 680px)').matches) return;
    const handle = event.target.closest('.widget-resize');
    const header = event.target.closest('.widget-head');
    const widget = event.target.closest('.widget');
    if (!widget || (!handle && !header)) return;
    if (!handle && event.target.closest('button, input, select, textarea, a')) return;
    const layout = layouts[widget.dataset.widget];
    pointerSession = {
      pointerId: event.pointerId,
      widget,
      id: widget.dataset.widget,
      mode: handle ? 'resize' : 'move',
      startX: event.clientX,
      startY: event.clientY,
      startLayout: { ...layout }
    };
    event.preventDefault();
    widget.classList.add('is-dragging');
    container.setPointerCapture(event.pointerId);
  });

  container.addEventListener('pointermove', (event) => {
    if (!pointerSession || event.pointerId !== pointerSession.pointerId) return;
    const style = window.getComputedStyle(container);
    const columnGap = parseFloat(style.columnGap) || 0;
    const rowGap = parseFloat(style.rowGap) || 0;
    const trackWidth = (container.clientWidth - columnGap * 11) / 12;
    const trackHeight = parseFloat(style.gridAutoRows) || 24;
    const deltaColumn = Math.round((event.clientX - pointerSession.startX) / (trackWidth + columnGap));
    const deltaRow = Math.round((event.clientY - pointerSession.startY) / (trackHeight + rowGap));
    const layout = layouts[pointerSession.id];
    const start = pointerSession.startLayout;

    if (pointerSession.mode === 'move') {
      layout.column = Math.min(13 - layout.width, Math.max(1, start.column + deltaColumn));
      layout.row = Math.min(200, Math.max(1, start.row + deltaRow));
    } else {
      const minWidth = pointerSession.id === 'schedule' ? 8 : 3;
      layout.width = Math.min(12, Math.max(minWidth, start.width + deltaColumn));
      layout.height = Math.min(30, Math.max(4, start.height + deltaRow));
      layout.column = Math.min(start.column, 13 - layout.width);
    }
    applyGridLayout(pointerSession.widget);
  });

  const finishPointerAction = (event) => {
    if (!pointerSession || event.pointerId !== pointerSession.pointerId) return;
    const { widget, id } = pointerSession;
    pointerSession = null;
    widget.classList.remove('is-dragging');
    resolveCollisions(id);
    saveLayout();
  };
  container.addEventListener('pointerup', finishPointerAction);
  container.addEventListener('pointercancel', finishPointerAction);

  container.addEventListener('dragstart', (event) => {
    if (container.classList.contains('is-editing')) event.preventDefault();
  });

  renderStatistics();
})();
