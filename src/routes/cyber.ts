import { Hono } from 'hono'
import { createPasswordSchema } from '../validation/schemas'
import { zValidator } from '@hono/zod-validator'
import { AIService } from '../services/ai-service'
import { AppContext } from '../types/env'


export const cyberRoutes = new Hono<AppContext>()
.post(
    '/',
    zValidator('json', createPasswordSchema),
    async (c) => {

        try {

            const body = await c.req.json()

            const inputText: string = body.password
            const personalInfo = body.personalInfo

            if (!inputText) 
                return c.json({error: 'Please send the text area.'}, 400)

            const aiService = new AIService(c)

            const aiReport = await aiService.callGenAi(inputText, personalInfo)

             return c.json({
                status: 'success',
                hybridScore: aiReport.hybridScore,
                processedResult: aiReport.report
            }, 200);

        }

        catch (error) {
             return c.json({ error: 'Unvalid json format or server error.' }, 500);
        }
    }
)

