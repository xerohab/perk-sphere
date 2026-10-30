import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';

// Auth pages - lazy loaded
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));

// Public pages - lazy loaded
const PublicLayout = lazy(() => import('@/components/public/PublicLayout'));
const Home = lazy(() => import('@/pages/public/Home'));
const PublicDestinations = lazy(() => import('@/pages/public/Destinations'));
const DestinationDetail = lazy(() => import('@/pages/public/DestinationDetail'));
const About = lazy(() => import('@/pages/public/About'));
const Advertise = lazy(() => import('@/pages/public/Advertise'));
const PrivacyPolicy = lazy(() => import('@/pages/public/PrivacyPolicy'));
const TermsOfService = lazy(() => import('@/pages/public/TermsOfService'));
const PartnerRegister = lazy(() => import('@/pages/public/PartnerRegister'));
const PartnerGuide = lazy(() => import('@/pages/public/PartnerGuide'));

// User portal - lazy loaded
const UserLayout = lazy(() => import('@/components/user/UserLayout'));
const Dashboard = lazy(() => import('@/pages/user/Dashboard'));
const Earn = lazy(() => import('@/pages/user/Earn'));
const Rewards = lazy(() => import('@/pages/user/Rewards'));
const Activity = lazy(() => import('@/pages/user/Activity'));
const Achievements = lazy(() => import('@/pages/user/Achievements'));
const PointsHistory = lazy(() => import('@/pages/user/PointsHistory'));
const Wallet = lazy(() => import('@/pages/user/Wallet'));
const Loyalty = lazy(() => import('@/pages/user/Loyalty'));
const Notifications = lazy(() => import('@/pages/user/Notifications'));
const ConnectedServices = lazy(() => import('@/pages/user/ConnectedServices'));
const PartnerAccounts = lazy(() => import('@/pages/user/PartnerAccounts'));
const BrowserExtension = lazy(() => import('@/pages/user/BrowserExtension'));
const Profile = lazy(() => import('@/pages/user/Profile'));
const Privacy = lazy(() => import('@/pages/user/Privacy'));
const Tasks = lazy(() => import('@/pages/user/Tasks'));
const Directory = lazy(() => import('@/pages/user/Directory'));
const DirectoryRequests = lazy(() => import('@/pages/user/DirectoryRequests'));
const Quizzes = lazy(() => import('@/pages/user/Quizzes'));
const Games = lazy(() => import('@/pages/user/Games'));
const WeeklyReports = lazy(() => import('@/pages/user/WeeklyReports'));
const RewardReview = lazy(() => import('@/pages/user/RewardReview'));

// Admin panel - lazy loaded
const AdminLayout = lazy(() => import('@/components/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'));
const AdminUserDetail = lazy(() => import('@/pages/admin/AdminUserDetail'));
const AdminPoints = lazy(() => import('@/pages/admin/AdminPoints'));
const AdminLoyaltyXP = lazy(() => import('@/pages/admin/AdminLoyaltyXP'));
const AdminRewards = lazy(() => import('@/pages/admin/AdminRewards'));
const AdminRedemptions = lazy(() => import('@/pages/admin/AdminRedemptions'));
const AdminSites = lazy(() => import('@/pages/admin/AdminSites'));
const AdminTrackedAccounts = lazy(() => import('@/pages/admin/AdminTrackedAccounts'));
const AdminSocialActivity = lazy(() => import('@/pages/admin/AdminSocialActivity'));
const AdminActivities = lazy(() => import('@/pages/admin/AdminActivities'));
const AdminRules = lazy(() => import('@/pages/admin/AdminRules'));
const AdminCampaigns = lazy(() => import('@/pages/admin/AdminCampaigns'));
const AdminSponsors = lazy(() => import('@/pages/admin/AdminSponsors'));
const AdminAchievements = lazy(() => import('@/pages/admin/AdminAchievements'));
const AdminRestrictions = lazy(() => import('@/pages/admin/AdminRestrictions'));
const AdminFraud = lazy(() => import('@/pages/admin/AdminFraud'));
const AdminNotifications = lazy(() => import('@/pages/admin/AdminNotifications'));
const AdminAnalytics = lazy(() => import('@/pages/admin/AdminAnalytics'));
const AdminAuditLog = lazy(() => import('@/pages/admin/AdminAuditLog'));
const AdminRoles = lazy(() => import('@/pages/admin/AdminRoles'));
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'));
const AdminDestinations = lazy(() => import('@/pages/admin/AdminDestinations'));
const AdminTasks = lazy(() => import('@/pages/admin/AdminTasks'));
const AdminPartners = lazy(() => import('@/pages/admin/AdminPartners'));
const AdminPartnerRewards = lazy(() => import('@/pages/admin/AdminPartnerRewards'));
const AdminDirectory = lazy(() => import('@/pages/admin/AdminDirectory'));
const AdminDirectoryRequests = lazy(() => import('@/pages/admin/AdminDirectoryRequests'));
const AdminQuizzes = lazy(() => import('@/pages/admin/AdminQuizzes'));
const AdminGames = lazy(() => import('@/pages/admin/AdminGames'));
const AdminReports = lazy(() => import('@/pages/admin/AdminReports'));
const AdminRewardReview = lazy(() => import('@/pages/admin/AdminRewardReview'));

const PageSpinner = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-secondary border-t-foreground rounded-full animate-spin"></div>
  </div>
);

const AppRoutes = () => (
  <Suspense fallback={<PageSpinner />}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Public site */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/destinations" element={<PublicDestinations />} />
        <Route path="/destinations/:id" element={<DestinationDetail />} />
        <Route path="/about" element={<About />} />
        <Route path="/advertise" element={<Advertise />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/partners/register" element={<PartnerRegister />} />
        <Route path="/partners/guide" element={<PartnerGuide />} />
      </Route>

      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<UserLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/earn" element={<Earn />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/directory" element={<Directory />} />
          <Route path="/directory-requests" element={<DirectoryRequests />} />
          <Route path="/quizzes" element={<Quizzes />} />
          <Route path="/games" element={<Games />} />
          <Route path="/weekly-reports" element={<WeeklyReports />} />
          <Route path="/reward-review" element={<RewardReview />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="/points-history" element={<PointsHistory />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/loyalty" element={<Loyalty />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/connected-services" element={<ConnectedServices />} />
          <Route path="/partner-accounts" element={<PartnerAccounts />} />
          <Route path="/browser-extension" element={<BrowserExtension />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/privacy" element={<Privacy />} />
        </Route>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/users/:id" element={<AdminUserDetail />} />
          <Route path="/admin/destinations" element={<AdminDestinations />} />
          <Route path="/admin/tasks" element={<AdminTasks />} />
          <Route path="/admin/partners" element={<AdminPartners />} />
          <Route path="/admin/partner-rewards" element={<AdminPartnerRewards />} />
          <Route path="/admin/directory" element={<AdminDirectory />} />
          <Route path="/admin/directory-requests" element={<AdminDirectoryRequests />} />
          <Route path="/admin/quizzes" element={<AdminQuizzes />} />
          <Route path="/admin/games" element={<AdminGames />} />
          <Route path="/admin/reports" element={<AdminReports />} />
          <Route path="/admin/reward-review" element={<AdminRewardReview />} />
          <Route path="/admin/points" element={<AdminPoints />} />
          <Route path="/admin/loyalty" element={<AdminLoyaltyXP />} />
          <Route path="/admin/rewards" element={<AdminRewards />} />
          <Route path="/admin/redemptions" element={<AdminRedemptions />} />
          <Route path="/admin/sites" element={<AdminSites />} />
          <Route path="/admin/tracked-accounts" element={<AdminTrackedAccounts />} />
          <Route path="/admin/social" element={<AdminSocialActivity />} />
          <Route path="/admin/activities" element={<AdminActivities />} />
          <Route path="/admin/rules" element={<AdminRules />} />
          <Route path="/admin/campaigns" element={<AdminCampaigns />} />
          <Route path="/admin/sponsors" element={<AdminSponsors />} />
          <Route path="/admin/achievements" element={<AdminAchievements />} />
          <Route path="/admin/restrictions" element={<AdminRestrictions />} />
          <Route path="/admin/fraud" element={<AdminFraud />} />
          <Route path="/admin/notifications" element={<AdminNotifications />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
          <Route path="/admin/audit" element={<AdminAuditLog />} />
          <Route path="/admin/roles" element={<AdminRoles />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  </Suspense>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return <PageSpinner />;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return <AppRoutes />;
};

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App
