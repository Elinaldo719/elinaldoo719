/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI, GeneratedImage, Content, Part} from '@google/genai';

const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

// -------------------- STATE -----------------------------------------------------------------
let uploadedImageBase64: string | null = null;

// -------------------- GET DOM ELEMENTS ----------------------------------------------------
const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;
const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
const imageGallery = document.getElementById('image-gallery');
const imageUploadInput = document.getElementById('image-upload') as HTMLInputElement;
const imagePreviewContainer = document.getElementById('image-preview-container');

// -------------------- EVENT LISTENERS ------------------------------------------------------
generateBtn.addEventListener('click', handleGeneration);
imageUploadInput.addEventListener('change', handleImageUpload);


// -------------------- IMAGE UPLOAD HANDLER --------------------------------------------------
function handleImageUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (file && imagePreviewContainer) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            // Store just the base64 part
            uploadedImageBase64 = result.split(',')[1];

            // Display preview
            imagePreviewContainer.innerHTML = ''; // Clear previous preview
            const img = document.createElement('img');
            img.src = result;
            
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '×';
            removeBtn.className = 'remove-image-btn';
            removeBtn.onclick = () => {
                imagePreviewContainer.innerHTML = '';
                uploadedImageBase64 = null;
                imageUploadInput.value = ''; // Reset file input
            };

            imagePreviewContainer.appendChild(img);
            imagePreviewContainer.appendChild(removeBtn);
        };
        reader.readAsDataURL(file);
    }
}

// -------------------- MAIN GENERATION LOGIC -----------------------------------------------
async function handleGeneration() {
  const textPrompt = promptInput.value;

  if (!textPrompt.trim() && !uploadedImageBase64) {
    alert('Please enter a prompt or upload an image.');
    return;
  }

  setLoadingState(true, 'Analyzing your idea...');
  if (imageGallery) {
      imageGallery.innerHTML = '<p class="message">Thinking... Gemini is analyzing your idea.</p>';
  }

  try {
      // Step 1: Use Gemini 2.5 Flash to create a better prompt
      const enhancedPrompt = await enhancePrompt(textPrompt, uploadedImageBase64);
      
      setLoadingState(true, 'Generating...');
      if (imageGallery) {
        imageGallery.innerHTML = '<p class="message">Idea analyzed! Now generating images...</p>';
      }

      // Step 2: Use the enhanced prompt with Imagen to generate images
      await generateImages(enhancedPrompt);

  } catch (error) {
      console.error("Error during generation process:", error);
      if (imageGallery) {
          imageGallery.innerHTML = '<p class="message">Error: Could not generate images. Check the console for details.</p>';
      }
  } finally {
      setLoadingState(false);
  }
}

// -------------------- STEP 1: ENHANCE PROMPT WITH GEMINI -----------------------------------
async function enhancePrompt(textPrompt: string, imageBase64: string | null): Promise<string> {
    const parts: Part[] = [];

    if (imageBase64) {
        parts.push({
            inlineData: {
                mimeType: 'image/jpeg', // Assuming jpeg, adjust if supporting more types
                data: imageBase64,
            },
        });
    }

    if (textPrompt) {
        parts.push({ text: textPrompt });
    }

    const contents: Content = { parts };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
            systemInstruction: "You are a world-class creative director. Your task is to analyze the user's input (which can be text, an image, or both) and create a single, clear, highly detailed, and vivid prompt for an advanced AI image generation model. The prompt should be a descriptive paragraph, focusing on visual details like subject, style, lighting, composition, and color palette. Output only the prompt itself, without any extra conversation or explanation.",
        },
    });

    console.log("Enhanced prompt by Gemini:", response.text);
    return response.text;
}

// -------------------- STEP 2: GENERATE IMAGES WITH IMAGEN -----------------------------------
async function generateImages(prompt: string) {
    const response = await ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: prompt,
        config: {
            numberOfImages: 3,
            aspectRatio: '1:1',
            outputMimeType: 'image/jpeg',
        },
    });

    // Preview the generated images
    if (imageGallery && response?.generatedImages) {
        imageGallery.innerHTML = ''; // Clear message
        if (response.generatedImages.length === 0) {
            imageGallery.innerHTML = '<p class="message">No images were generated. This could be due to the safety policy. Try a different prompt.</p>';
        }
        response.generatedImages.forEach((generatedImage: GeneratedImage, index: number) => {
            if (generatedImage.image?.imageBytes) {
                const src = `data:image/jpeg;base64,${generatedImage.image.imageBytes}`;
                const img = new Image();
                img.src = src;
                img.alt = `${prompt.substring(0, 50)}... - Image ${Number(index) + 1}`;
                imageGallery.appendChild(img);
            }
        });
    }

    console.log('Full Imagen response:', response);
}

// -------------------- UTILITY: SET LOADING STATE ---------------------------------------------
function setLoadingState(isLoading: boolean, message: string = 'Generate Images') {
    generateBtn.disabled = isLoading;
    generateBtn.textContent = isLoading ? message : 'Generate Images';
}