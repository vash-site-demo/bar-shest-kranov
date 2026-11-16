import { defaultContent } from './data.js';

const storageKey = 'six-taps-content-v1';
const cloneDefaults = () => JSON.parse(JSON.stringify(defaultContent));
let content = loadContent();
let lastBookingText = '';
let toastTimer;

const beerList = document.querySelector('#beer-list');
const eventList = document.querySelector('#event-list');
const bookingDialog = document.querySelector('#booking-dialog');
const editorDialog = document.querySelector('#editor-dialog');
const bookingForm = document.querySelector('#booking-form');
const bookingSuccess = document.querySelector('#booking-success');
const eventSelect = document.querySelector('#booking-event');
const toast = document.querySelector('#toast');

// Локальное хранилище нужно только для демонстрации работы будущего редактора.
function loadContent() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved?.beers?.length === 6 && saved?.events?.length === 3) return saved;
  } catch (error) {
    console.warn('Не удалось прочитать сохранённые демо-данные.');
  }
  return cloneDefaults();
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return { day: '—', month: 'Дата' };
  return {
    day: new Intl.DateTimeFormat('ru-RU', { day: '2-digit' }).format(date),
    month: new Intl.DateTimeFormat('ru-RU', { month: 'short' }).format(date).replace('.', '')
  };
}

function eventLabel(event) {
  const date = new Date(`${event.date}T12:00:00`);
  const formatted = Number.isNaN(date.getTime()) ? event.date : new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(date);
  return `${event.title} — ${formatted}, ${event.time}`;
}

function renderContent() {
  beerList.innerHTML = content.beers.map((beer, index) => `
    <article class="beer-card">
      <span class="beer-number">${String(index + 1).padStart(2, '0')}</span>
      <div><h3>${escapeHtml(beer.name)}</h3><p class="beer-style">${escapeHtml(beer.style)}</p></div>
      <strong class="beer-price">${escapeHtml(beer.price)}</strong>
      <p class="beer-description">${escapeHtml(beer.description)}</p>
      <div class="beer-meta"><span>${escapeHtml(beer.abv)} алк.</span><span>IBU ${escapeHtml(beer.ibu)}</span></div>
    </article>`).join('');

  eventList.innerHTML = content.events.map((event, index) => {
    const date = formatDate(event.date);
    return `<article class="event-card">
      <time class="event-date" datetime="${escapeHtml(event.date)}T${escapeHtml(event.time)}"><span class="event-day">${date.day}</span><span class="event-month">${date.month}</span></time>
      <div><div class="event-top"><h3>${escapeHtml(event.title)}</h3><span class="event-time">${escapeHtml(event.time)}</span></div>
      <p class="event-artist">${escapeHtml(event.artist)}</p><p class="event-description">${escapeHtml(event.description)}</p>
      <button class="text-button" type="button" data-event-booking="${index}">Забронировать на вечер <svg><use href="#i-arrow"/></svg></button></div>
    </article>`;
  }).join('');

  const firstOption = '<option value="Просто вечер в баре">Просто вечер в баре</option>';
  eventSelect.innerHTML = firstOption + content.events.map((event, index) => `<option value="${index}">${escapeHtml(eventLabel(event))}</option>`).join('');
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('visible');
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3500);
}

function openDialog(dialog) {
  if (!dialog.open) dialog.showModal();
  document.body.classList.add('modal-open');
}

function closeDialog(dialog) {
  dialog.close();
  if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open');
}

function setBookingView(isSuccess) {
  bookingForm.hidden = isSuccess;
  bookingSuccess.hidden = !isSuccess;
}

function openBooking(eventIndex) {
  setBookingView(false);
  closeMobileMenu();
  eventSelect.value = eventIndex === undefined ? 'Просто вечер в баре' : String(eventIndex);
  const firstEvent = content.events[0];
  if (!document.querySelector('#booking-date').value && firstEvent) document.querySelector('#booking-date').value = firstEvent.date;
  openDialog(bookingDialog);
}

function editorField(label, key, value, type = 'text', className = '') {
  const id = `editor-${key}`;
  return `<div class="field ${className}"><label for="${id}">${label}</label><input id="${id}" name="${key}" type="${type}" value="${escapeHtml(value)}" required></div>`;
}

function fillEditor(data) {
  document.querySelector('#beer-editor').innerHTML = data.beers.map((beer, index) => `
    <fieldset class="editor-beer"><legend class="editor-beer-title">Кран ${index + 1}</legend><div class="form-grid" data-beer="${index}">
      ${editorField('Название', `beer-${index}-name`, beer.name, 'text', 'field--name')}
      ${editorField('Стиль', `beer-${index}-style`, beer.style)}
      ${editorField('Крепость', `beer-${index}-abv`, beer.abv)}
      ${editorField('IBU', `beer-${index}-ibu`, beer.ibu)}
      ${editorField('Цена', `beer-${index}-price`, beer.price)}
      <div class="field field--description"><label for="editor-beer-${index}-description">Описание</label><textarea id="editor-beer-${index}-description" name="beer-${index}-description" required>${escapeHtml(beer.description)}</textarea></div>
    </div></fieldset>`).join('');

  document.querySelector('#event-editor').innerHTML = data.events.map((event, index) => `
    <fieldset class="editor-event" data-event="${index}"><legend class="editor-beer-title">Событие ${index + 1}</legend>
      ${editorField('Название', `event-${index}-title`, event.title, 'text', 'field--full')}
      ${editorField('Исполнитель', `event-${index}-artist`, event.artist, 'text', 'field--full')}
      ${editorField('Дата', `event-${index}-date`, event.date, 'date')}
      ${editorField('Время', `event-${index}-time`, event.time, 'time')}
      <div class="field field--full"><label for="editor-event-${index}-description">Описание</label><textarea id="editor-event-${index}-description" name="event-${index}-description" required>${escapeHtml(event.description)}</textarea></div>
    </fieldset>`).join('');
}

function readEditor() {
  return {
    beers: content.beers.map((_, index) => ({
      name: document.querySelector(`[name="beer-${index}-name"]`).value.trim(),
      style: document.querySelector(`[name="beer-${index}-style"]`).value.trim(),
      abv: document.querySelector(`[name="beer-${index}-abv"]`).value.trim(),
      ibu: document.querySelector(`[name="beer-${index}-ibu"]`).value.trim(),
      price: document.querySelector(`[name="beer-${index}-price"]`).value.trim(),
      description: document.querySelector(`[name="beer-${index}-description"]`).value.trim()
    })),
    events: content.events.map((_, index) => ({
      title: document.querySelector(`[name="event-${index}-title"]`).value.trim(),
      artist: document.querySelector(`[name="event-${index}-artist"]`).value.trim(),
      date: document.querySelector(`[name="event-${index}-date"]`).value,
      time: document.querySelector(`[name="event-${index}-time"]`).value,
      description: document.querySelector(`[name="event-${index}-description"]`).value.trim()
    }))
  };
}

document.querySelectorAll('[data-booking]').forEach((button) => button.addEventListener('click', () => openBooking()));
eventList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-event-booking]');
  if (button) openBooking(Number(button.dataset.eventBooking));
});

document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => closeDialog(button.closest('dialog'))));
document.querySelectorAll('dialog').forEach((dialog) => {
  dialog.addEventListener('close', () => {
    if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open');
  });
  dialog.addEventListener('click', (event) => {
    const rect = dialog.getBoundingClientRect();
    const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    if (outside) closeDialog(dialog);
  });
});

bookingForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(bookingForm);
  const name = String(formData.get('name')).trim();
  const phone = String(formData.get('phone')).trim();
  const date = String(formData.get('date'));
  const phoneDigits = phone.replace(/\D/g, '');
  const errors = {
    name: name.length < 2 ? 'Укажите имя — минимум 2 буквы.' : '',
    phone: phoneDigits.length < 10 ? 'Укажите телефон, чтобы владелец мог подтвердить бронь.' : '',
    date: !date ? 'Выберите дату визита.' : ''
  };

  Object.entries(errors).forEach(([key, message]) => {
    const input = bookingForm.elements[key];
    input.setAttribute('aria-invalid', String(Boolean(message)));
    bookingForm.querySelector(`[data-error="${key}"]`).textContent = message;
  });
  const firstError = Object.keys(errors).find((key) => errors[key]);
  if (firstError) {
    bookingForm.elements[firstError].focus();
    return;
  }

  const eventValue = String(formData.get('event'));
  const occasion = eventValue === 'Просто вечер в баре' ? eventValue : eventLabel(content.events[Number(eventValue)]);
  const guests = String(formData.get('guests'));
  const comment = String(formData.get('comment')).trim();
  lastBookingText = `Заявка на стол в «Шесть кранов»\nИмя: ${name}\nТелефон: ${phone}\nДата: ${date}\nГостей: ${guests}\nПовод: ${occasion}${comment ? `\nКомментарий: ${comment}` : ''}`;
  document.querySelector('#booking-summary').textContent = lastBookingText;
  setBookingView(true);
  bookingSuccess.querySelector('h3').focus?.();
});

document.querySelector('#edit-booking').addEventListener('click', () => setBookingView(false));
document.querySelector('#copy-booking').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(lastBookingText);
    showToast('Заявка скопирована');
  } catch (error) {
    const helper = document.createElement('textarea');
    helper.value = lastBookingText;
    document.body.append(helper);
    helper.select();
    const copied = document.execCommand('copy');
    helper.remove();
    showToast(copied ? 'Заявка скопирована' : 'Выделите текст заявки и скопируйте вручную');
  }
});

document.querySelector('#open-editor').addEventListener('click', () => {
  fillEditor(content);
  document.querySelector('#editor-status').textContent = '';
  openDialog(editorDialog);
});

document.querySelector('#reset-content').addEventListener('click', () => {
  fillEditor(cloneDefaults());
  document.querySelector('#editor-status').textContent = 'Демо-данные подставлены. Нажмите «Сохранить изменения».';
});

document.querySelector('#editor-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  content = readEditor();
  try {
    localStorage.setItem(storageKey, JSON.stringify(content));
    renderContent();
    closeDialog(editorDialog);
    showToast('Меню и афиша обновлены на этом устройстве');
  } catch (error) {
    document.querySelector('#editor-status').textContent = 'Не удалось сохранить. Проверьте настройки хранилища в браузере.';
  }
});

const menuToggle = document.querySelector('.menu-toggle');
const mobileMenu = document.querySelector('#mobile-menu');
function closeMobileMenu() {
  mobileMenu.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Открыть меню');
}
menuToggle.addEventListener('click', () => {
  const isOpen = mobileMenu.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
  menuToggle.setAttribute('aria-label', isOpen ? 'Закрыть меню' : 'Открыть меню');
});
mobileMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMobileMenu));

// Дата брони не может быть в прошлом.
const today = new Date();
const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
document.querySelector('#booking-date').min = localToday;

renderContent();

if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
} else {
  document.querySelectorAll('.reveal').forEach((element) => element.classList.add('is-visible'));
}
