# Skillify

Skillify is a web application designed to help students practice for the Btech based competative exams by generating unique multiple-choice questions (MCQs) based on selected subjects and chapters.

## Purpose

The main goal of Skillify is to provide an interactive platform for students to prepare for their exams with customized question sets, immediate feedback on their answers, and a focus on different difficulty levels.

## Backend Overview

The backend of Skillify is built using Node.js and utilizes the Google Generative AI API to generate questions. The key features of the backend include:

- **Generate Unique Questions**: The backend generates multiple-choice questions tailored to the subject and chapter selected by the user. The questions are created to meet the difficulty level required for the JEE Mains and JEE Advanced exams.
- **Evaluate User Answers**: After answering the questions, users can submit their answers for evaluation. The system will compare the user's answers to the correct answers and provide feedback, including explanations for each question.

### How It Works

1. **Generate Questions**: 
   - The user selects a subject and chapter.
   - The backend generates a prompt for the Google Generative AI model to create 10 unique MCQs.
   - Questions are formatted with four options and an explanation for the correct answer.

2. **Evaluate Answers**: 
   - The user submits their answers.
   - The backend evaluates the responses against the correct answers and provides feedback on which answers were correct or incorrect, along with explanations.

