import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

// Public pages
import PublicLayout from '@/components/public/PublicLayout';
import Home from '@/pages/public/Home';
import PublicDestinations from '@/pages/public/Destinations';
import DestinationDetail from '@/pages/public/DestinationDetail';
import About from '@/pages/public/About';

// User portal
import UserLayout from '@/components/user/UserLayout';
import Dashboard from '@/pages/user/Dashboard';
import Earn from '@/pages/user/Earn';
import Rewards from '@/pages/user/Rewards';
import Activity from '@/pages/user/Activity';
import Achievements from '@/pages/user/Achievements';
import PointsHistory from '@/pages/user/PointsHistory';
import Loyalty from '@/pages/user/Loyalty';
import Notifications from '@/pages/user/Notifications';
import ConnectedServices from '@/pages/user/ConnectedServices';
import Devices from '@/pages/user/Devices';
import Profile from '@/pages/user/Profile';
import Privacy from '@/pages/user/Privacy';

// Admin panel
import AdminLayout from '@/components/admin/AdminLayout';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminUsers from '@/pages/admin/AdminUsers';
import AdminUserDetail from '@/pages/admin/AdminUserDetail';
import AdminPoints from '@/pages/admin/AdminPoints';
import AdminLoyaltyXP from '@/pages/admin/AdminLoyaltyXP';
import AdminRewards from '@/pages/admin/AdminRewards';
import AdminRedemptions from '@/pages/admin/AdminRedemptions';
import AdminSites from '@/pages/admin/AdminSites';
import AdminTrackedAccounts from '@/pages/admin/AdminTrackedAccounts';
import AdminSocialActivity from '@/pages/admin/AdminSocialActivity';
import AdminActivities from '@/pages/admin/AdminActivities';
import AdminRules from '@/pages/admin/AdminRules';
import AdminCampaigns from '@/pages/admin/AdminCampaigns';
import AdminAchievements from '@/pages/admin/AdminAchievements';
import AdminRestrictions from '@/pages/admin/AdminRestrictions';
import AdminFraud from '@/pages/admin/AdminFraud';
import AdminNotifications from '@/pages/admin/AdminNotifications';
import AdminAnalytics from '@/pages/admin/AdminAnalytics';
import AdminAuditLog from '@/pages/admin/AdminAuditLog';
import AdminRoles from '@/pages/admin/AdminRoles';
import AdminSettings from '@/pages/admin/AdminSettings';
import AdminDestinations from '@/pages/admin/AdminDestinations';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
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
      </Route>

      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<UserLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/earn" element={<Earn />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="/points-history" element={<PointsHistory />} />
          <Route path="/loyalty" element={<Loyalty />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/connected-services" element={<ConnectedServices />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/privacy" element={<Privacy />} />
        </Route>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/users/:id" element={<AdminUserDetail />} />
          <Route path="/admin/destinations" element={<AdminDestinations />} />
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
  );
};


function App() {

  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App