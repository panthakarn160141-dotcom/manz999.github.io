import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialize Gemini AI Client
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new GoogleGenAI({ apiKey });
}

// Health Check API
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", shop: "ร้านซ่อมมือถือรัตภูมิ By ฟู่เฮงโมบาย" });
});

// Gemini AI Repair Diagnosis & Cost Estimator API
app.post("/api/gemini/analyze-repair", async (req, res) => {
  try {
    const { brand, model, symptoms } = req.body;
    if (!brand || !symptoms) {
      return res.status(400).json({ error: "กรุณาระบุยี่ห้อและอาการเสีย" });
    }

    const ai = getGeminiClient();
    const prompt = `คุณคือผู้เชี่ยวชาญช่างซ่อมมือถือระดับมืออาชีพของร้าน "ร้านซ่อมมือถือรัตภูมิ By ฟู่เฮงโมบาย"
ช่วยวิเคราะห์อาการเสียและประเมินแนวทางแก้ไขสำหรับ:
- ยี่ห้อ: ${brand}
- รุ่น: ${model || "ไม่ระบุรุ่น"}
- อาการเสียที่ได้รับแจ้ง: ${symptoms}

โปรดตอบในรูปแบบ JSON สั้นๆ ดังนี้ (ภาษาไทย):
{
  "possibleCauses": ["สาเหตุที่ 1", "สาเหตุที่ 2"],
  "recommendedParts": ["อะไหล่ที่อาจต้องใช้ 1", "อะไหล่ที่ต้องใช้ 2"],
  "estimatedPartsCostMin": ต้นทุนอะไหล่ประมาณต่ำสุด(ตัวเลขบาท),
  "estimatedPartsCostMax": ต้นทุนอะไหล่ประมาณสูงสุด(ตัวเลขบาท),
  "suggestedLaborFee": ค่าแรงซ่อมแนะนำ(ตัวเลขบาท),
  "technicianAdvice": "คำแนะนำทางเทคนิคสำหรับการซ่อมอย่างละเอียดและระมัดระวัง"
}
ตอบกลับด้วย JSON ที่ถูกต้องตามโครงสร้างด้านบนเท่านั้น ห้ามมี markdown หรือข้อความอื่น`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const text = response.text || "";
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsedData = JSON.parse(cleanJson);

    return res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error("Gemini Analyze Error:", error);
    return res.status(500).json({
      error: error.message || "เกิดข้อผิดพลาดในการวิเคราะห์ด้วย AI",
    });
  }
});

// Gemini AI Customer Notification Message Generator
app.post("/api/gemini/generate-message", async (req, res) => {
  try {
    const { customerName, deviceModel, status, repairFee, jobCode } = req.body;
    
    const ai = getGeminiClient();
    const prompt = `สร้างข้อความสั้นๆ ภาษาไทยที่เป็นกันเองและสุภาพ สำหรับส่งให้ลูกค้าทาง LINE หรือ SMS จาก "ร้านซ่อมมือถือรัตภูมิ By ฟู่เฮงโมบาย"
ข้อมูลงานซ่อม:
- รหัสงาน: ${jobCode || "-"}
- ชื่อลูกค้า: ${customerName || "คุณลูกค้า"}
- รุ่นมือถือ: ${deviceModel}
- สถานะงานซ่อม: ${status}
- ค่าซ่อม/ค่าบริการ: ${repairFee ? repairFee + " บาท" : "ยังไม่ได้สรุป"}

ข้อความควรน่าเชื่อถือ แจ้งสถานะชัดเจน บอกเบอร์ติดต่อร้าน หรือเวลารับเครื่อง ตอบกลับเป็นข้อความเพียวๆ 1 ข้อความ`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return res.json({ success: true, message: response.text?.trim() });
  } catch (error: any) {
    console.error("Gemini Message Gen Error:", error);
    return res.status(500).json({
      error: error.message || "ไม่สามารถสร้างข้อความได้",
    });
  }
});

async function startServer() {
  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

startServer();
