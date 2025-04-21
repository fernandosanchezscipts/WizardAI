const chatbox = document.getElementById('chatbox');
const toggle = document.getElementById('theme-toggle');
const sendBtn = document.querySelector('.send');
const imageInput = document.getElementById('image-upload');
const pdfInput = document.getElementById('pdf-upload');
const modal = document.querySelector('.modal');
const modalClose = document.querySelector('.modal-close-button');
const extraBtn = document.getElementById('addExtra');
const userInput = document.getElementById('user-input');
const triggerImage = document.getElementById('trigger-image');
const triggerPDF = document.getElementById('trigger-pdf');

let conversation = [];

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function addMessage(role, content, isImage = false) {
  const bubble = document.createElement('div');
  bubble.classList.add(role === 'user' ? 'chat-box-body-send' : 'chat-box-body-receive');

  if (isImage) {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(content);
    img.className = 'preview-img';
    bubble.appendChild(img);
  } else {
    bubble.innerText = content;
  }

  const timestamp = document.createElement('span');
  timestamp.className = 'timestamp';
  timestamp.innerText = formatTime(new Date());
  bubble.appendChild(timestamp);

  chatbox.appendChild(bubble);
  chatbox.scrollTop = chatbox.scrollHeight;
}

function showTypingIndicator() {
  const typingBubble = document.createElement('div');
  typingBubble.classList.add('chat-box-body-receive', 'loading');
  typingBubble.innerHTML = `
    <div class="dot-typing">
      <span></span><span></span><span></span>
    </div>
  `;
  chatbox.appendChild(typingBubble);
  chatbox.scrollTop = chatbox.scrollHeight;
  return typingBubble;
}

async function sendMessage(message, image = null, pdf = null) {
  const formData = new FormData();
  formData.append('message', message || '');
  if (image) formData.append('image', image);
  if (pdf) formData.append('pdf', pdf);

  const loading = showTypingIndicator();

  try {
    const res = await fetch('/chat', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    loading.remove();
    addMessage('gpt', data.reply);
    conversation.push({ role: 'assistant', content: data.reply });
  } catch (err) {
    loading.remove();
    addMessage('gpt', 'Something went wrong.');
  }
}

sendBtn.addEventListener('click', async () => {
  const message = userInput.value.trim();
  const image = imageInput.files[0];
  const pdf = pdfInput.files[0];

  if (!message && !image && !pdf) return;

  if (message) {
    addMessage('user', message);
    conversation.push({ role: 'user', content: message });
  } else if (image) {
    addMessage('user', image, true);
    conversation.push({ role: 'user', content: '[Image uploaded]' });
  } else if (pdf) {
    addMessage('user', pdf.name);
    conversation.push({ role: 'user', content: '[PDF uploaded]' });
  }

  await sendMessage(message, image, pdf);

  userInput.value = '';
  imageInput.value = '';
  pdfInput.value = '';
});

toggle.addEventListener('click', () => {
  document.body.classList.toggle('light-mode');
});

extraBtn.addEventListener('click', () => {
  modal.classList.toggle('show-modal');
});

modalClose.addEventListener('click', () => {
  modal.classList.remove('show-modal');
});

triggerImage.addEventListener('click', () => {
  modal.classList.remove('show-modal');
  setTimeout(() => imageInput.click(), 100);
});

triggerPDF.addEventListener('click', () => {
  modal.classList.remove('show-modal');
  setTimeout(() => pdfInput.click(), 100);
});

imageInput.addEventListener('change', async () => {
  const file = imageInput.files[0];
  if (!file) return;
  addMessage('user', file, true);
  conversation.push({ role: 'user', content: '[Image uploaded]' });
  await sendMessage('', file, null);
  imageInput.value = '';
});

pdfInput.addEventListener('change', async () => {
  const file = pdfInput.files[0];
  if (!file) return;
  addMessage('user', file.name);
  conversation.push({ role: 'user', content: '[PDF uploaded]' });
  await sendMessage('', null, file);
  pdfInput.value = '';
});




