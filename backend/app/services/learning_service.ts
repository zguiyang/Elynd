import { inject } from '@adonisjs/core'
import LearningRecord from '#models/learning_record'

@inject()
export class LearningService {
  async updateLearningDays(
    userId: number
  ): Promise<{ learningDays: number; isFirstLoginToday: boolean }> {
    const today = new Date().toISOString().split('T')[0]

    const existingRecord = await LearningRecord.query()
      .where('userId', userId)
      .where('date', today)
      .first()

    if (existingRecord) {
      return {
        learningDays: existingRecord.learningDays,
        isFirstLoginToday: false,
      }
    }

    const lastRecord = await LearningRecord.query()
      .where('userId', userId)
      .orderBy('date', 'desc')
      .first()

    const newLearningDays = lastRecord ? lastRecord.learningDays + 1 : 1

    await LearningRecord.create({
      userId,
      learningDays: newLearningDays,
      date: today,
    })

    return {
      learningDays: newLearningDays,
      isFirstLoginToday: true,
    }
  }

  async getLearningDays(userId: number): Promise<number> {
    const latestRecord = await LearningRecord.query()
      .where('userId', userId)
      .orderBy('date', 'desc')
      .first()

    return latestRecord?.learningDays ?? 0
  }

  async getLearningRecords(userId: number) {
    return LearningRecord.query().where('userId', userId).orderBy('date', 'desc').limit(30)
  }
}
