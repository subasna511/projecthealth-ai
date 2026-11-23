
const TIME_ZONE = 'Australia/Sydney';

let lastRunDate = '';
let running = false;

function getSydneyDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function getSydneyHour(): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TIME_ZONE,
      hour: '2-digit',
      hourCycle: 'h23'
    }).format(new Date())
  );
}

export function startDailyMonitor(
  runAssessment: () => Promise<void>
): void {
  async function checkSchedule() {
    const today = getSydneyDate();

    if (getSydneyHour() < 9 || running || lastRunDate === today) {
      return;
    }

    running = true;

    try {
      await runAssessment();
      lastRunDate = today;
      console.log(`Daily risk monitoring completed: ${today}`);
    } catch (error) {
      console.error('Daily risk monitoring failed:', error);
    } finally {
      running = false;
    }
  }

  // Check once per minute while the backend is running.
  setInterval(() => {
    void checkSchedule();
  }, 60_000);

  void checkSchedule();

  console.log('Daily risk monitoring scheduler started');
}
