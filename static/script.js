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
let currentUtterance = null;
let isAITyping = false; // Flag to track if AI is already typing

function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function speak(text) {
    speechSynthesis.cancel();
    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.lang = 'en-US';
    speechSynthesis.speak(currentUtterance);
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
        const textNode = document.createElement('span');
        textNode.innerHTML = content.replace(/\n/g, '<br>').replace(/\*/g, '\uFF0A'); // Replace with FULLWIDTH ASTERISK
        bubble.appendChild(textNode);

        if (role !== 'user') {
            const controls = document.createElement('div');
            controls.style.marginTop = '8px';
            controls.style.display = 'flex';
            controls.style.gap = '6px';

            const playBtn = document.createElement('button');
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
            playBtn.onclick = () => speak(content.replace(/\uFF0A/g, '*')); // Revert for speech
            playBtn.style.pointerEvents = 'auto'; // Ensure button is clickable

            const pauseBtn = document.createElement('button');
            pauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            pauseBtn.onclick = () => speechSynthesis.pause();
            pauseBtn.style.pointerEvents = 'auto';

            const resumeBtn = document.createElement('button');
            resumeBtn.innerHTML = '<i class="fas fa-redo"></i>';
            resumeBtn.onclick = () => speechSynthesis.resume();
            resumeBtn.style.pointerEvents = 'auto';

            const stopBtn = document.createElement('button');
            stopBtn.innerHTML = '<i class="fas fa-stop"></i>';
            stopBtn.onclick = () => speechSynthesis.cancel();
            stopBtn.style.pointerEvents = 'auto';

            [playBtn, pauseBtn, resumeBtn, stopBtn].forEach(btn => {
                btn.style.padding = '4px 8px';
                btn.style.borderRadius = '6px';
                btn.style.border = 'none';
                btn.style.cursor = 'pointer';
                btn.style.backgroundColor = '#3b82f6';
                btn.style.color = '#fff';
            });

            controls.appendChild(playBtn);
            controls.appendChild(pauseBtn);
            controls.appendChild(resumeBtn);
            controls.appendChild(stopBtn);
            bubble.appendChild(controls);
        }
    }

    const timestamp = document.createElement('span');
    timestamp.className = 'timestamp';
    timestamp.innerText = formatTime(new Date());
    bubble.appendChild(timestamp);

    chatbox.appendChild(bubble);
    chatbox.scrollTop = chatbox.scrollHeight;

    if (window.MathJax) MathJax.typesetPromise([bubble]).catch(err => console.error("MathJax error:", err));
}

function showTypingIndicator() {
    if (isAITyping) return null; // Don't show if already typing
    isAITyping = true;
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

function removeTypingIndicator(typingBubble) {
    if (typingBubble && typingBubble.parentNode) {
        typingBubble.parentNode.removeChild(typingBubble);
        isAITyping = false; // Reset the flag
    }
}

async function handleAIResponse(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';
    let gptBubble = null;
    const loadingIndicator = document.querySelector('.chat-box-body-receive.loading');
    let responseStarted = false; // Flag to track if AI response has started

    if (loadingIndicator) {
        removeTypingIndicator(loadingIndicator);
    }

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            accumulatedText += chunk;

            let displayText = accumulatedText;
            try {
                const parsed = JSON.parse(accumulatedText);
                if (parsed && parsed.reply !== undefined) {
                    displayText = parsed.reply.replace(/\n/g, '<br>');
                    if (!responseStarted && loadingIndicator) {
                        removeTypingIndicator(loadingIndicator);
                        responseStarted = true;
                    }
                } else {
                    displayText = accumulatedText.replace(/\n/g, '<br>');
                    if (!responseStarted && accumulatedText.trim()) {
                        removeTypingIndicator(loadingIndicator);
                        responseStarted = true;
                    }
                }
            } catch (e) {
                displayText = accumulatedText.replace(/\n/g, '<br>');
                if (!responseStarted && accumulatedText.trim()) {
                    removeTypingIndicator(loadingIndicator);
                    responseStarted = true;
                }
            }

            let processedText = displayText.replace(/\*/g, '\uFF0A'); // Replace with FULLWIDTH ASTERISK
            processedText = processedText.replace(/\uFF0A\uFF0A/g, ''); // Remove double fullwidth asterisks

            if (!gptBubble) {
                gptBubble = document.createElement('div');
                gptBubble.classList.add('chat-box-body-receive', 'ai-formatted-message');
                gptBubble.innerHTML = processedText;
                chatbox.appendChild(gptBubble);
            } else {
                gptBubble.innerHTML = processedText;
            }

            chatbox.scrollTop = chatbox.scrollHeight;
        }

        if (gptBubble && window.MathJax) {
            await MathJax.typesetPromise([gptBubble]);
        }

        let finalContent = accumulatedText;
        try {
            const parsedFinal = JSON.parse(accumulatedText);
            if (parsedFinal && parsedFinal.reply !== undefined) {
                finalContent = parsedFinal.reply.replace(/\uFF0A/g, '*').replace(/\*\*/g, ''); // Revert and remove double for storage
            } else {
                finalContent = accumulatedText.replace(/\uFF0A/g, '*').replace(/\*\*/g, ''); // Revert and remove double for storage
            }
        } catch (e) {
            finalContent = accumulatedText.replace(/\uFF0A/g, '*').replace(/\*\*/g, ''); // Revert and remove double for storage
        }
        conversation.push({ role: 'assistant', content: finalContent });

    } catch (err) {
        console.error("Error in handleAIResponse:", err);
        addMessage('gpt', 'Something went wrong processing the response.');
        isAITyping = false; // Reset flag on error
    } finally {
        isAITyping = false; // Ensure flag is reset after response
    }
}


async function sendMessage(message, image = null, pdf = null) {
    const formData = new FormData();
    formData.append('message', message || '');
    if (image) formData.append('image', image);
    if (pdf) formData.append('pdf', pdf);

    const loadingIndicator = showTypingIndicator();

    try {
        const res = await fetch('/chat', {
            method: 'POST',
            body: formData
        });
        await handleAIResponse(res);
    } catch (err) {
        if (loadingIndicator) {
            removeTypingIndicator(loadingIndicator);
        }
        addMessage('gpt', 'Something went wrong while sending the message.');
        console.error(err);
        isAITyping = false; // Reset flag on error
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

    userInput.value = '';
    imageInput.value = '';
    pdfInput.value = '';

    const loadingIndicator = showTypingIndicator();
    await sendMessage(message, image, pdf);
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
    const loadingIndicator = showTypingIndicator();
    const formData = new FormData();
    formData.append('image', file);
    try {
        const res = await fetch('/chat', {
            method: 'POST',
            body: formData
        });
        await handleAIResponse(res);
    } catch (err) {
        removeTypingIndicator(loadingIndicator);
        addMessage('gpt', 'Something went wrong processing the image.');
        console.error(err);
        isAITyping = false; // Reset flag on error
    }
    imageInput.value = '';
});

pdfInput.addEventListener('change', async () => {
    const file = pdfInput.files[0];
    if (!file) return;
    addMessage('user', file.name);
    conversation.push({ role: 'user', content: '[PDF uploaded]' });
    const loadingIndicator = showTypingIndicator();
    const formData = new FormData();
    formData.append('pdf', file);
    try {
        const res = await fetch('/chat', {
            method: 'POST',
            body: formData
        });
        await handleAIResponse(res);
    } catch (err) {
        removeTypingIndicator(loadingIndicator);
        addMessage('gpt', 'Something went wrong processing the PDF.');
        console.error(err);
        isAITyping = false; // Reset flag on error
    }
    pdfInput.value = '';
});
