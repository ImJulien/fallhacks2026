import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Grab the comma-separated string and split it into an array
const keys = process.env.GEMINI_API_KEYS?.split(',') || []

export async function POST(req: NextRequest) {
  try {
    // Randomly select a key for this specific request
    const randomKey = keys[Math.floor(Math.random() * keys.length)]
    
    // Initialize the SDK with the chosen key inside the request scope
    const genAI = new GoogleGenerativeAI(randomKey)

    const formData = await req.formData()
    const files = formData.getAll('image').filter((value): value is File => value instanceof File)

    if (files.length === 0) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `
      Analyze this image of a fridge or pantry. Return a JSON array of objects representing the food items detected.
      Each object MUST have:
      - "id": a unique string (generate a random one)
      - "name": generic name of the item
      - "brand": brand name if visible, otherwise ""
      - "quantity": estimated amount (e.g. "half full", "1 jar", "3 pieces")
      - "box_2d": an array of 4 numbers [ymin, xmin, ymax, xmax] scaled strictly between 0 and 1000 representing the bounding box.
      
      Respond ONLY with the raw JSON array. Do not include markdown formatting like \`\`\`json.
    `

    const imageParts = await Promise.all(files.map(async (file) => {
      const arrayBuffer = await file.arrayBuffer()
      return {
        inlineData: {
          data: Buffer.from(arrayBuffer).toString('base64'),
          mimeType: file.type,
        },
      }
    }))

    const result = await model.generateContent([prompt, ...imageParts])

    const responseText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim()
    const items = JSON.parse(responseText)

    return NextResponse.json({ items })

  } catch (error) {
    console.error('Vision API Error:', error)
    return NextResponse.json({ error: 'Failed to process image' }, { status: 500 })
  }
}