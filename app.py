print("STARTING app.py...")

from flask import Flask, render_template, request, jsonify, Response, session
from flask_session import Session
from dotenv import load_dotenv
import openai
import os
import base64
import fitz  # PyMuPDF
import pandas as pd
import re
import logging

print("Imports complete")

# Load environment variables
load_dotenv(dotenv_path=".env")
openai.api_key = os.getenv("OPENAI_API_KEY")
print("USING API KEY:", openai.api_key[:8] + "..." if openai.api_key else "None")

app = Flask(__name__)
app.config["SESSION_TYPE"] = "filesystem"
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "default_secret")
Session(app)

logging.basicConfig(level=logging.DEBUG)

@app.route("/")
def home():
    return render_template("index.html")

def clean_reply(text):
    # Strip formatting artifacts and LaTeX/math triggers
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)      # bold
    text = re.sub(r"#+\s*", "", text)                 # markdown headings
    text = re.sub(r"(?<!\\)\$", "", text)             # stray $
    text = re.sub(r"(?<!\\)\*", "", text)             # stray *
    text = re.sub(r"(?<!\\)_", "", text)              # stray underscores
    text = re.sub(r"\\[a-zA-Z]+\b", "", text)         # LaTeX commands like \frac, \text
    text = re.sub(r"\s{2,}", " ", text)               # collapse extra spaces
    return text.strip()

def wrap_if_non_math(text):
    contains_math = bool(re.search(r"\\\(|\\\)|\$(.*?)\$|\\frac|\\sum|\\int", text))
    return f"<pre class='no-math'>{text}</pre>" if not contains_math else text

@app.route("/chat", methods=["POST"])
def chat():
    if "conversation" not in session:
        session["conversation"] = [{
            "role": "system",
            "content": (
                "You are WizardAI, a helpful accounting and financial assistant.\n"
                "Do NOT use LaTeX for text content like journal entries or tax breakdowns.\n"
                "Only use MathJax for real math equations (like algebra or calculus).\n"
                "Use clean plain text and line breaks for journal entries, taxes, and explanations.\n"
                "For journal entries, follow this format:\n"
                "Account           | Debit    | Credit\n"
                "Cash              | 80,000   |\n"
                "Sales Revenue     |          | 80,000"
            )
        }]

    message = request.form.get("message", "").strip()
    image = request.files.get("image")
    file = request.files.get("pdf")

    if message and not image and not file:
        session["conversation"].append({"role": "user", "content": message})
        conversation_copy = session["conversation"][-10:]

        def generate():
            full_reply = ""
            try:
                response = openai.chat.completions.create(
                    model="gpt-4o",
                    messages=conversation_copy,
                    stream=True
                )
                for chunk in response:
                    content = getattr(chunk.choices[0].delta, "content", None)
                    if content:
                        full_reply += content
                        yield content
            except Exception as e:
                yield f"\nGPT error: {str(e)}"
            finally:
                cleaned = clean_reply(full_reply)
                safe_output = wrap_if_non_math(cleaned)
                session["conversation"].append({"role": "assistant", "content": safe_output})
                session.modified = True
                yield safe_output

        return Response(generate(), mimetype="text/plain")

    elif image:
        try:
            img_data = base64.b64encode(image.read()).decode("utf-8")
            session["conversation"].append({
                "role": "user",
                "content": [
                    {"type": "text", "text": message or "Describe this image:"},
                    {"type": "image_url", "image_url": {"url": f"data:{image.mimetype};base64,{img_data}"}}
                ]
            })
            response = openai.chat.completions.create(
                model="gpt-4o",
                messages=session["conversation"][-10:],
                max_tokens=1000
            )
            reply = clean_reply(response.choices[0].message.content)
            safe_output = wrap_if_non_math(reply)
        except Exception as e:
            safe_output = f"GPT image error: {str(e)}"

        session["conversation"].append({"role": "assistant", "content": safe_output})
        return jsonify({"reply": safe_output})

    elif file:
        try:
            filename = file.filename.lower()
            if filename.endswith(".pdf"):
                doc = fitz.open(stream=file.read(), filetype="pdf")
                text = "".join([page.get_text() for page in doc])[:2000]
            elif filename.endswith(".csv"):
                text = pd.read_csv(file).to_string(index=False)[:2000]
            elif filename.endswith(".xlsx"):
                text = pd.read_excel(file).to_string(index=False)[:2000]
            else:
                text = "Unsupported file format."

            session["conversation"].append({"role": "user", "content": message or text})
            session["conversation"] = [
                msg for msg in session["conversation"]
                if msg.get("content") and isinstance(msg["content"], str)
            ]

            response = openai.chat.completions.create(
                model="gpt-4o",
                messages=session["conversation"][-10:],
                max_tokens=1000
            )
            reply = clean_reply(response.choices[0].message.content)
            safe_output = wrap_if_non_math(reply)
        except Exception as e:
            safe_output = f"GPT file error: {str(e)}"

        session["conversation"].append({"role": "assistant", "content": safe_output})
        return jsonify({"reply": safe_output})

    return jsonify({"reply": "No valid message, image, or file received."})

if __name__ == "__main__":
    print("Flask running at http://0.0.0.0:10000")
    app.run(host="0.0.0.0", port=10000, debug=True)
    