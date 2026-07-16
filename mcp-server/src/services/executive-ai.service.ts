import { RuleBasedAIProvider } from "../providers/ai.provider";
import { DashboardService } from "./dashboard.service";
import { AlertsService } from "./alerts.service";
import { TaskService } from "./task.service";
import { BaseService } from "./base.service";

export class ExecutiveAIService extends BaseService {
  private readonly ai = new RuleBasedAIProvider();

  async summary() {
    const dashboardService = new DashboardService(this.auth);
    const alertsService = new AlertsService(this.auth);
    const taskService = new TaskService(this.auth);

    const [dashboard, alerts, tasks] = await Promise.all([
      dashboardService.getDashboard(),
      alertsService.listAlerts(10),
      taskService.listTasks(),
    ]);

    const payload = JSON.stringify({ dashboard, alerts, tasks: tasks.slice(0, 10) });
    const text = await this.ai.summarize(payload);

    return {
      summary: text,
      generated_at: new Date().toISOString(),
    };
  }

  async recommendations() {
    const dashboardService = new DashboardService(this.auth);
    const dashboard = await dashboardService.getDashboard();
    const text = JSON.stringify(dashboard);

    return {
      recommendations: await this.ai.recommend(text),
      generated_at: new Date().toISOString(),
    };
  }
}
