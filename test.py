import sys
import os

if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

if "USER_AGENT" not in os.environ:
    os.environ["USER_AGENT"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

from langchain_community.document_loaders import WebBaseLoader
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser

load_dotenv()

model = ChatGoogleGenerativeAI(model="gemini-3.5-flash")

# Prompt template
prompt = PromptTemplate(
    template="""
    Answer the following question directly, concisely, and clearly.
    Highlight key names, terms, numbers, and the core answer in **bold**.
    Avoid filler phrases like "Based on the provided text...".

    Question:
    {question}

    Text:
    {text}
    """,
    input_variables=["question", "text"]
)

parser = StrOutputParser()

# Load webpage
url = "https://www.flipkart.com/apple-macbook-air-m2-16-gb-256-gb-ssd-macos-sequoia-mc7x4hn-a/p/itmdc5308fa78421"

loader = WebBaseLoader(url)
documents = loader.load()


# Create the chain only once
chain = prompt | model | parser

# Ask multiple questions without reloading the webpage
while True:
    question = input("\nAsk a question (or type 'exit'): ")

    if question.lower() == "exit":
        break

    response = chain.invoke({
        "question": question,
        "text": documents[0].page_content[:8000]
    })

    print("\nAnswer:", response)