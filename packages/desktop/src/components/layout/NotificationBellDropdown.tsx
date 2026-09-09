import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  supabase,
  getAdminNotifications,
  AdminNotificationsResult,
  LateTeacherNotification,
  UnpaidStudentNotification,
} from "@fanion/shared";

interface NotificationBellDropdownProps {
  userRole?: string;
}

export const NotificationBellDropdown: React.FC<NotificationBellDropdownProps> = ({ userRole }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"teachers" | "students">("teachers");
  const [notifications, setNotifications] = useState<AdminNotificationsResult>({
    lateTeachers: [],
    unpaidStudents: [],
    totalCount: 0,
  });

  const dropdownRef = useRef<HTMLDivElement>(null);

  const [effectiveRole, setEffectiveRole] = useState<string | undefined>(userRole);

  useEffect(() => {
    if (userRole) {
      setEffectiveRole(userRole);
    } else {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single()
            .then(({ data }) => {
              if (data?.role) setEffectiveRole(data.role);
            });
        }
      });
    }
  }, [userRole]);

  const isAuthorized = effectiveRole === "principal" || effectiveRole === "directeur_etudes";

  const loadNotifications = async () => {
    if (!isAuthorized) return;
    try {
      setLoading(true);
      const res = await getAdminNotifications();
      setNotifications(res);
    } catch (err) {
      console.warn("Erreur chargement notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      loadNotifications();
      const interval = setInterval(loadNotifications, 120000);
      return () => clearInterval(interval);
    }
  }, [isAuthorized]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (!isAuthorized) return null;

  const totalCount = notifications.totalCount;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bouton Cloche */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) loadNotifications();
        }}
        className="relative p-2 rounded-full text-slate hover:text-ink hover:bg-paper transition focus:outline-none"
        title="Centre de notifications (Direction)"
        aria-label="Centre de notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {totalCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-signal-red px-1 text-[10px] font-bold text-white shadow-xs">
            {totalCount > 99 ? "99+" : totalCount}
          </span>
        )}
      </button>

      {/* Popover Panneau Déroulant */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white border border-line shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header du panneau */}
          <div className="p-3 bg-paper border-b border-line flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm text-ink">Notifications Direction</span>
              {totalCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-signal-red/10 text-signal-red">
                  {totalCount} alerte{totalCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <button
              onClick={() => loadNotifications()}
              disabled={loading}
              className="text-xs text-slate hover:text-ink font-medium p-1 transition"
              title="Rafraîchir les notifications"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {/* Onglets Catégories */}
          <div className="grid grid-cols-2 text-xs font-semibold border-b border-line bg-white">
            <button
              onClick={() => setActiveTab("teachers")}
              className={`py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition ${
                activeTab === "teachers"
                  ? "border-signal-red text-signal-red bg-signal-red/5 font-bold"
                  : "border-transparent text-slate hover:text-ink"
              }`}
            >
              <span>Enseignants en retard</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate/10 text-slate">
                {notifications.lateTeachers.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("students")}
              className={`py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition ${
                activeTab === "students"
                  ? "border-amber-600 text-amber-700 bg-amber-50/60 font-bold"
                  : "border-transparent text-slate hover:text-ink"
              }`}
            >
              <span>Impayés échus</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate/10 text-slate">
                {notifications.unpaidStudents.length}
              </span>
            </button>
          </div>

          {/* Corps de la liste */}
          <div className="max-h-80 overflow-y-auto divide-y divide-line/60">
            {loading ? (
              <div className="p-6 text-center text-xs text-slate italic">
                Calcul des notifications en cours…
              </div>
            ) : activeTab === "teachers" ? (
              notifications.lateTeachers.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate">
                  <span className="text-emerald-700 font-bold block mb-1">✓ À jour</span>
                  Aucun retard de soumission de notes pour la séquence active.
                </div>
              ) : (
                notifications.lateTeachers.map((item: LateTeacherNotification) => (
                  <div
                    key={item.id}
                    className="p-3 hover:bg-slate/5 transition flex flex-col gap-1.5 text-xs text-ink"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-signal-red flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {item.teacherName}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 flex-shrink-0">
                        +{item.daysLate}j retard
                      </span>
                    </div>

                    <p className="text-[11px] text-slate leading-snug">
                      Notes de <strong className="text-ink">{item.subjectName}</strong> non soumises pour{" "}
                      <strong className="text-ink">{item.className}</strong> ({item.sequenceName}).
                    </p>

                    <div className="flex items-center justify-between pt-1 text-[10px] text-slate">
                      <span>Délai dépassé le : {item.deadlineDate}</span>
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          navigate(`/grades?classId=${item.classId}`);
                        }}
                        className="text-ink font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        Consulter classe →
                      </button>
                    </div>
                  </div>
                ))
              )
            ) : notifications.unpaidStudents.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate">
                <span className="text-emerald-700 font-bold block mb-1">✓ Aucune échéance dépassée</span>
                Toutes les tranches échues sont intégralement payées.
              </div>
            ) : (
              notifications.unpaidStudents.map((item: UnpaidStudentNotification) => (
                <div
                  key={item.id}
                  className="p-3 hover:bg-slate/5 transition flex flex-col gap-1.5 text-xs text-ink"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-amber-800 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      {item.studentName}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 flex-shrink-0">
                      +{item.daysOverdue}j retard
                    </span>
                  </div>

                  <p className="text-[11px] text-slate leading-snug">
                    <strong className="text-ink">{item.className}</strong> • {item.trancheLabel} : reste dû{" "}
                    <strong className="text-signal-red">
                      {Math.round(item.remainingDue).toLocaleString("fr-FR")} FCFA
                    </strong>
                  </p>

                  <div className="flex items-center justify-between pt-1 text-[10px] text-slate">
                    <span>Échéance : {item.dueDate}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          navigate(`/students/${item.studentId}`);
                        }}
                        className="text-ink font-semibold hover:underline cursor-pointer"
                      >
                        Fiche
                      </button>
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          navigate(`/finance/payments?studentId=${item.studentId}&classId=${item.classId}`);
                        }}
                        className="text-emerald-700 font-bold hover:underline cursor-pointer"
                      >
                        Payer →
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer du panneau */}
          <div className="p-2.5 bg-paper border-t border-line text-center">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate("/dashboard");
              }}
              className="text-[11px] text-slate hover:text-ink font-semibold transition cursor-pointer"
            >
              Voir la vue synthétique sur le Tableau de bord
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBellDropdown;
