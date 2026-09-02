type SorvyApi = typeof import("./sorvyApi");

let apiPromise: Promise<SorvyApi> | null = null;

function loadSorvyApi(): Promise<SorvyApi> {
  apiPromise ??= import("./sorvyApi");
  return apiPromise;
}

export type { WorkspaceData } from "./sorvyApi";

export const assignLead = (...args: Parameters<SorvyApi["assignLead"]>) =>
  loadSorvyApi().then((api) => api.assignLead(...args));
export const askBusinessAssistant = (...args: Parameters<SorvyApi["askBusinessAssistant"]>) =>
  loadSorvyApi().then((api) => api.askBusinessAssistant(...args));
export const archiveProfessional = (...args: Parameters<SorvyApi["archiveProfessional"]>) =>
  loadSorvyApi().then((api) => api.archiveProfessional(...args));
export const changeAccountStatus = (...args: Parameters<SorvyApi["changeAccountStatus"]>) =>
  loadSorvyApi().then((api) => api.changeAccountStatus(...args));
export const confirmInfinitePayReturn = (...args: Parameters<SorvyApi["confirmInfinitePayReturn"]>) =>
  loadSorvyApi().then((api) => api.confirmInfinitePayReturn(...args));
export const createInfinitePayCheckout = (...args: Parameters<SorvyApi["createInfinitePayCheckout"]>) =>
  loadSorvyApi().then((api) => api.createInfinitePayCheckout(...args));
export const createTeamMember = (...args: Parameters<SorvyApi["createTeamMember"]>) =>
  loadSorvyApi().then((api) => api.createTeamMember(...args));
export const deleteLeadRecord = (...args: Parameters<SorvyApi["deleteLeadRecord"]>) =>
  loadSorvyApi().then((api) => api.deleteLeadRecord(...args));
export const getDailyPostAssignment = (...args: Parameters<SorvyApi["getDailyPostAssignment"]>) =>
  loadSorvyApi().then((api) => api.getDailyPostAssignment(...args));
export const loginWorkspace = (...args: Parameters<SorvyApi["loginWorkspace"]>) =>
  loadSorvyApi().then((api) => api.loginWorkspace(...args));
export const logoutWorkspace = (...args: Parameters<SorvyApi["logoutWorkspace"]>) =>
  loadSorvyApi().then((api) => api.logoutWorkspace(...args));
export const manageDailyPost = (...args: Parameters<SorvyApi["manageDailyPost"]>) =>
  loadSorvyApi().then((api) => api.manageDailyPost(...args));
export const recordDailyPostEvent = (...args: Parameters<SorvyApi["recordDailyPostEvent"]>) =>
  loadSorvyApi().then((api) => api.recordDailyPostEvent(...args));
export const recordSubscriptionIntent = (...args: Parameters<SorvyApi["recordSubscriptionIntent"]>) =>
  loadSorvyApi().then((api) => api.recordSubscriptionIntent(...args));
export const requestPasswordReset = (...args: Parameters<SorvyApi["requestPasswordReset"]>) =>
  loadSorvyApi().then((api) => api.requestPasswordReset(...args));
export const registerPendingSubscription = (...args: Parameters<SorvyApi["registerPendingSubscription"]>) =>
  loadSorvyApi().then((api) => api.registerPendingSubscription(...args));
export const restoreProfessional = (...args: Parameters<SorvyApi["restoreProfessional"]>) =>
  loadSorvyApi().then((api) => api.restoreProfessional(...args));
export const restoreWorkspaceSession = (...args: Parameters<SorvyApi["restoreWorkspaceSession"]>) =>
  loadSorvyApi().then((api) => api.restoreWorkspaceSession(...args));
export const saveProfessionalProfile = (...args: Parameters<SorvyApi["saveProfessionalProfile"]>) =>
  loadSorvyApi().then((api) => api.saveProfessionalProfile(...args));
export const saveProfessionalProfileAsHq = (...args: Parameters<SorvyApi["saveProfessionalProfileAsHq"]>) =>
  loadSorvyApi().then((api) => api.saveProfessionalProfileAsHq(...args));
export const setTeamMemberStatus = (...args: Parameters<SorvyApi["setTeamMemberStatus"]>) =>
  loadSorvyApi().then((api) => api.setTeamMemberStatus(...args));
export const startProfessionalTrial = (...args: Parameters<SorvyApi["startProfessionalTrial"]>) =>
  loadSorvyApi().then((api) => api.startProfessionalTrial(...args));
export const subscribeWorkspace = (...args: Parameters<SorvyApi["subscribeWorkspace"]>) =>
  loadSorvyApi().then((api) => api.subscribeWorkspace(...args));
export const updateLeadCrm = (...args: Parameters<SorvyApi["updateLeadCrm"]>) =>
  loadSorvyApi().then((api) => api.updateLeadCrm(...args));
export const updateProfessionalSlug = (...args: Parameters<SorvyApi["updateProfessionalSlug"]>) =>
  loadSorvyApi().then((api) => api.updateProfessionalSlug(...args));
