print("STARTING app.py...")

from flask import Flask, render_template, request, jsonify, session
from flask_session import Session
from dotenv import load_dotenv
import openai
import os
import base64
import re

print("Imports complete")

# Load environment variables
load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")
print("API KEY LOADED")

app = Flask(__name__)

# Configure server-side session
app.config["SESSION_TYPE"] = "filesystem"
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "default_secret")
Session(app)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    if "conversation" not in session:
        session["conversation"] = [
            {
                "role": "system",
                "content": "You are WizardAI, an assistant that responds to user text and images using vision + language reasoning."
            }
        ]

    message = request.form.get("message", "").strip()
    image = request.files.get("image")
    pdf = request.files.get("pdf")

    if message and not image and not pdf:
        session["conversation"].append({"role": "user", "content": message})

    elif image:
        img_data = base64.b64encode(image.read()).decode("utf-8")
        session["conversation"].append({
            "role": "user",
            "content": [
                {"type": "text", "text": message or "Describe this image:"},
                {"type": "image_url", "image_url": {"url": f"data:{image.mimetype};base64,{img_data}"}}
            ]
        })

    elif pdf:
        session["conversation"].append({
            "role": "user",
            "content": message or f"A PDF was uploaded: {pdf.filename} (cannot read content directly)."
        })

    try:
        response = openai.chat.completions.create(
            model="gpt-4o",
            messages=session["conversation"],
            max_tokens=1000
        )

        reply = response.choices[0].message.content

        # Strip markdown: bold, italic, code, etc.
        reply = re.sub(r"\*\*(.*?)\*\*", r"\1", reply)
        reply = re.sub(r"\*(.*?)\*", r"\1", reply)
        reply = re.sub(r"_(.*?)_", r"\1", reply)
        reply = re.sub(r"`(.*?)`", r"\1", reply)

        session["conversation"].append({"role": "assistant", "content": reply})
        return jsonify({"reply": reply})

    except Exception as e:
        print("GPT Error:", e)
        return jsonify({"reply": "GPT-4o failed. Try again later."})


if __name__ == "__main__":
    print("Flask running at http://0.0.0.0:10000")
    app.run(host="0.0.0.0", port=10000, debug=True)
    



