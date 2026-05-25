import { Hono } from 'hono'
import { cyberRoutes } from './routes/cyber'
import { AppContext } from './types/env'
import { corsMiddleware } from './middleware/cors'
import { validateApiKey } from './middleware/auth'

const app = new Hono<AppContext>()

app.use('*',corsMiddleware)

app.use('*', validateApiKey)

app.route('/api/cyber', cyberRoutes)

app.get('/', (c) => c.text('Hono Cyber App is running!'))


export default app


