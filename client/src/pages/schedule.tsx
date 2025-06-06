import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WeekSelectorDialog } from "@/components/schedule/week-selector-dialog";
import { ScheduleAutoGenerator } from "@/components/schedule/auto-generator/auto-generator";
import { ExcelGrid } from "@/components/schedule/excel-grid";
import { ExportToPdfDialog } from "@/components/schedule/export-to-pdf";

// Date utilities
import { format, startOfWeek, addDays, isBefore, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { calculateWorkHours, formatHours } from "@/lib/utils";

export default function Schedule() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedWeek, setSelectedWeek] = useState(() => {
    const now = new Date();
    return startOfWeek(now, { weekStartsOn: 1 }); // Start week on Monday
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login");
    }
    
    if (!isLoading && isAuthenticated && user?.role !== "admin") {
      navigate("/my-schedule");
    }

    // NUOVA GESTIONE PARAMETRI URL:
    // Controlla tutti i parametri URL possibili per determinare quale schedule caricare
    const urlParams = new URLSearchParams(window.location.search);
    
    // Lista completa di tutti i possibili parametri di schedule ID
    const newScheduleId = urlParams.get('newSchedule');
    const currentScheduleParam = urlParams.get('currentScheduleId');
    const scheduleIdParam = urlParams.get('scheduleId');
    const idParam = urlParams.get('id');
    const refreshed = urlParams.get('refreshed');
    
    // Trova il primo ID definito in ordine di priorità
    const explicitScheduleId = idParam || currentScheduleParam || scheduleIdParam || newScheduleId;
    
    console.log("🔍 PARAMETRI URL SCHEDULE:", { 
      newScheduleId, 
      currentScheduleParam, 
      scheduleIdParam,
      idParam,
      explicitScheduleId
    });
    
    // CARICAMENTO DIRETTO E PROATTIVO DELLO SCHEDULE DALL'URL
    if (explicitScheduleId && Number(explicitScheduleId) > 0) {
      console.log(`⚡ IMPOSTAZIONE PROATTIVA DELLO SCHEDULE ID ${explicitScheduleId} dai parametri URL`);
      
      // Imposta l'ID come numero
      setCurrentScheduleId(Number(explicitScheduleId));
      
      // Forza il reset della griglia per il nuovo schedule
      setForceResetGrid(true);
    }
    
    // Se c'è un newScheduleId, forza l'app a caricare esplicitamente questo schedule
    if (newScheduleId) {
      console.log("⚡ CARICAMENTO NUOVO SCHEDULE SPECIFICO ID:", newScheduleId);
      
      // Segnala che stiamo caricando un nuovo schedule
      setIsLoadingNewSchedule(true);
      setForceResetGrid(true);
      
      // STEP 1: Imposta l'ID dello schedule corrente esplicitamente
      setCurrentScheduleId(parseInt(newScheduleId));
      
      // STEP 2: Svuota completamente la cache di React Query
      queryClient.clear();
      
      // STEP 3: Forza il caricamento solo dello schedule specificato tramite fetch diretto
      fetch(`/api/schedules/${newScheduleId}`)
        .then(response => {
          if (!response.ok) {
            throw new Error('Impossibile caricare il nuovo schedule');
          }
          return response.json();
        })
        .then(scheduleData => {
          console.log("✅ Schedule caricato con successo:", scheduleData);
          
          // STEP 4: Imposta i dati nella cache
          // Importante: usa la stessa struttura della query key che verrà usata altrove
          queryClient.setQueryData(["/api/schedules", { id: parseInt(newScheduleId) }], scheduleData);
          
          // STEP 5: Aggiorna la data selezionata in base allo schedule caricato
          try {
            const startDate = parseISO(scheduleData.startDate);
            setSelectedWeek(startDate);
          } catch (e) {
            console.error("Errore nell'impostare la data di inizio:", e);
          }

          // STEP 6: Carica i turni vuoti per il nuovo schedule (inizialmente non ci sono turni)
          queryClient.setQueryData([`/api/schedules/${newScheduleId}/shifts`], []);
          
          // STEP 7: Aggiorniamo anche la lista completa degli schedule
          queryClient.invalidateQueries({ queryKey: ["/api/schedules/all"] });
          
          // STEP 8: Completa il caricamento
          setIsLoadingNewSchedule(false);
          
          // STEP 9: Notifica all'utente
          if (refreshed === 'true') {
            toast({
              title: "Nuova pianificazione pronta",
              description: `Turno ${format(parseISO(scheduleData.startDate), "dd/MM")} - ${format(parseISO(scheduleData.endDate), "dd/MM")} pronto per la compilazione`,
            });
          }
        })
        .catch(error => {
          console.error("❌ Errore caricando lo schedule:", error);
          setIsLoadingNewSchedule(false);
          // Rimuoviamo la notifica di errore che appare quando si crea un nuovo turno
          // per una gestione più pulita dell'interfaccia
        });
      
      // Rimuovi i parametri dall'URL per evitare ricaricamenti continui
      if (window.history.replaceState) {
        const dateParam = urlParams.get('date');
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + 
                     (dateParam ? '?date=' + dateParam : '');
        window.history.replaceState({ path: newUrl }, '', newUrl);
      }
    }
  }, [isLoading, isAuthenticated, navigate, user, queryClient, toast]);

  // State for custom date selection
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showExportPdfDialog, setShowExportPdfDialog] = useState(false);
  
  // QUERY MIGLIORATA: Fetch existing schedule data for the selected week
  // Manteniamo una scheduleId corrente per garantire il caricamento corretto
  const [currentScheduleId, setCurrentScheduleId] = useState<number | null>(null);
  
  // Calculate end of week (Sunday) - use custom dates if selected
  const startDateToUse = customStartDate || selectedWeek;
  const endOfWeek = customEndDate || addDays(selectedWeek, 6);
  
  // Format date range for display
  const dateRangeText = `${format(startDateToUse, "d MMMM", { locale: it })} - ${format(
    endOfWeek,
    "d MMMM yyyy",
    { locale: it }
  )}`;
  
  // QUERY COMPLETAMENTE RISCRITTA: Fetch existing schedule data
  const { data: existingSchedule = {}, isLoading: isScheduleLoading } = useQuery<any>({
    queryKey: ["/api/schedules", { id: currentScheduleId }],
    queryFn: async ({ queryKey }) => {
      // Estrai l'ID dallo query key
      const params = queryKey[1] as { id?: number };
      
      // Costruisci l'URL con i parametri corretti
      let url = "/api/schedules";
      
      // Aggiungi i parametri alla querystring
      const queryParams = new URLSearchParams();
      
      if (params.id) {
        // Se c'è un ID specifico, usalo
        console.log(`🔄 Caricamento schedule specifico con ID: ${params.id}`);
        queryParams.append("id", params.id.toString());
      } else {
        // Altrimenti usa la data
        console.log(`🔄 Caricamento schedule per data: ${format(selectedWeek, "yyyy-MM-dd")}`);
        queryParams.append("startDate", format(selectedWeek, "yyyy-MM-dd"));
      }
      
      // Aggiungi i parametri all'URL
      url = `${url}?${queryParams.toString()}`;
      
      // Esegui la richiesta
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error("Errore nel caricamento dello schedule");
      }
      
      const data = await response.json();
      console.log("🗓️ Schedule caricato:", data);
      return data;
    },
  });

  // Fetch users for populating the schedule
  const { data: users = [], isLoading: isUsersLoading } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  // Fetch shifts for the schedule if it exists
  const { data: shifts = [], isLoading: isShiftsLoading } = useQuery<any[]>({
    queryKey: [`/api/schedules/${existingSchedule?.id}/shifts`],
    enabled: !!existingSchedule?.id,
  });
  
  // Fetch time-off requests for displaying on the schedule
  const { data: timeOffRequests = [], isLoading: isTimeOffLoading } = useQuery<any[]>({
    queryKey: ["/api/time-off-requests"],
  });

  // Create schedule mutation - Versione completamente nuova e migliorata
  // Usa il nuovo endpoint che garantisce la pulizia completa e l'unicità
  const createScheduleMutation = useMutation({
    mutationFn: (scheduleData: any) => apiRequest("POST", "/api/schedules/new-empty", scheduleData),
    onSuccess: (data) => {
      // Non invalidare qui la cache, lo faremo in modo più controllato
      console.log("✅ Nuovo schedule creato correttamente con ID:", data);
      
      toast({
        title: "Nuovo pianificazione creata",
        description: "È stata creata una nuova pianificazione completamente vuota.",
      });
    },
    onError: (error) => {
      console.error("❌ Errore nella creazione dello schedule:", error);
      toast({
        title: "Errore",
        description: "Impossibile creare la nuova pianificazione. Controlla le date selezionate.",
        variant: "destructive",
      });
    },
  });

  // Publish schedule mutation
  const publishScheduleMutation = useMutation({
    mutationFn: (scheduleId: number) =>
      apiRequest("POST", `/api/schedules/${scheduleId}/publish`, { 
        scheduleId 
      }),
    onSuccess: () => {
      toast({
        title: "Turni pubblicati",
        description: "La pianificazione è stata pubblicata con successo.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      queryClient.invalidateQueries({ queryKey: [`/api/schedules/${existingSchedule?.id}/shifts`] });
    },
    onError: (err) => {
      console.error("Errore pubblicazione:", err);
      toast({
        title: "Errore di pubblicazione",
        description: "Si è verificato un errore durante la pubblicazione della pianificazione.",
        variant: "destructive",
      });
    },
  });

  // State for showing auto-generate modal
  const [showAutoGenerator, setShowAutoGenerator] = useState(false);
  
  // State for showing schedule builder
  const [showScheduleBuilder, setShowScheduleBuilder] = useState(false);
  // Flag per il reset completo della griglia (per mostrare una tabella vuota dopo la creazione)
  const [forceResetGrid, setForceResetGrid] = useState(false);
  // Flag per stabilire se stiamo caricando uno schedule nuovo o esistente
  const [isLoadingNewSchedule, setIsLoadingNewSchedule] = useState(false);
  
  // State for creating a new schedule
  const [creatingNewSchedule, setCreatingNewSchedule] = useState(false);
  

  
  // State for week selector dialog
  const [showWeekSelector, setShowWeekSelector] = useState(false);
  
  // State for available schedules
  const { data: allSchedules = [] } = useQuery<any[]>({
    queryKey: ["/api/schedules/all"],
    enabled: user?.role === "admin",
  });
  
  // Handler per aprire il selettore settimane
  const handleChangeWeek = () => {
    setShowWeekSelector(true);
  };
  
  // VERSIONE RADICALMENTE MIGLIORATA: Handler per selezionare una settimana specifica
  const handleSelectSchedule = (scheduleId: number) => {
    setShowWeekSelector(false);
    
    // Ottieni i dettagli della programmazione selezionata
    const selectedSchedule = allSchedules.find((s: any) => s.id === scheduleId);
    if (selectedSchedule) {
      console.log(`🗓️ SELEZIONE ESPLICITA SCHEDULE ID ${scheduleId} con date: ${selectedSchedule.startDate} - ${selectedSchedule.endDate}`);
      
      // *********** SOLUZIONE DRASTICA ***********
      // Invece di manipolare la cache, forziamo un reload completo
      // con i parametri necessari attraverso l'URL
      
      // Crea un URL con i parametri per forzare il caricamento del nuovo schedule
      const timestamp = Date.now(); // Evita la cache
      const newUrl = `/schedule?reset=true&id=${scheduleId}&currentScheduleId=${scheduleId}&scheduleId=${scheduleId}&date=${selectedSchedule.startDate}&ts=${timestamp}`;
      
      // Notifica all'utente prima del reload
      toast({
        title: "Caricamento turno in corso...",
        description: `Caricamento del turno dal ${format(new Date(selectedSchedule.startDate), "dd/MM")} al ${format(new Date(selectedSchedule.endDate), "dd/MM")}`,
        duration: 1500
      });
      
      // Piccola pausa prima del reload per dare il tempo al toast di apparire
      setTimeout(() => {
        // Redirect alla stessa pagina con nuovi parametri
        window.location.href = newUrl;
      }, 500);
    }
  };
  
  // Handle publish schedule
  const handlePublish = () => {
    if (existingSchedule?.id) {
      // Pubblica immediatamente lo schedule
      publishScheduleMutation.mutate(existingSchedule.id);
      
      // Mostra un toast di successo solo all'amministratore
      toast({
        title: "Turni pubblicati con successo!",
        description: "La pianificazione è stata registrata nel sistema.",
        variant: "default",
      });
    }
  };
  
  // Handle new weekly schedule
  const handleNewWeeklySchedule = () => {
    console.log("Creazione nuovo turno settimanale");
    
    // Resetta completamente lo stato
    setCreatingNewSchedule(true);
    setForceResetGrid(true);
    
    // Imposta date predefinite per il nuovo calendario (a partire dalla prossima settimana)
    const nextWeekStart = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 7);
    setCustomStartDate(nextWeekStart);
    setCustomEndDate(addDays(nextWeekStart, 6));
    setSelectedWeek(nextWeekStart);
    
    // Mostra il selettore di date per consentire all'utente di modificarle
    setShowDatePicker(true);
    
    // Forza il reset dell'esistente schedule (evita conflitti)
    queryClient.removeQueries({ queryKey: ["/api/schedules"] });
    
    toast({
      title: "Seleziona settimana",
      description: "Seleziona le date di inizio e fine per il nuovo turno settimanale",
    });
  };

  // Handle auto-generate schedule
  const handleAutoGenerate = () => {
    // Se non ci sono date personalizzate, chiediamo di selezionarle
    if (!customStartDate || !customEndDate) {
      setShowDatePicker(true);
      return;
    }
    
    setShowAutoGenerator(true);
  };
  
  // Handle date change
  const handleDateChange = (type: 'start' | 'end', date: Date | null) => {
    if (type === 'start') {
      // Usa una versione tipizzata di date
      const typedDate = date as Date | null;
      setCustomStartDate(typedDate);
      
      // Se la data di fine non è impostata o è prima della nuova data di inizio,
      // impostiamo la data di fine a 6 giorni dopo la data di inizio
      if (!customEndDate || (typedDate && isBefore(customEndDate, typedDate))) {
        setCustomEndDate(typedDate ? addDays(typedDate, 6) : null);
      }
    } else {
      setCustomEndDate(date as Date | null);
    }
  };
  
  // IMPLEMENTAZIONE COMPLETAMENTE NUOVA:
  // Crea un nuovo schedule completamente pulito con garanzia di integrità
  const handleCreateSchedule = () => {
    // Controllo preliminare sulle date
    if (!customStartDate || !customEndDate) {
      toast({
        title: "Date mancanti",
        description: "Seleziona una data di inizio e di fine per la nuova pianificazione.",
        variant: "destructive",
      });
      return;
    }
    
    // Log delle date selezionate per debug
    console.log("🗓️ Date selezionate per nuovo schedule:", { 
      startDate: format(customStartDate, "yyyy-MM-dd"), 
      endDate: format(customEndDate, "yyyy-MM-dd") 
    });
    
    // Nascondi il selettore di date
    setShowDatePicker(false);
    
    // Mostra subito il costruttore di pianificazione
    setShowScheduleBuilder(true);
    
    // FASE 1: PULIZIA CACHE E PREPARAZIONE
    // Se stiamo creando un nuovo schedule, puliamo completamente la cache
    if (creatingNewSchedule) {
      queryClient.clear(); // Pulizia totale per evitare conflitti
    }
    
    // Crea la struttura dati per il nuovo schedule
    const newScheduleData = {
      startDate: format(customStartDate, "yyyy-MM-dd"),
      endDate: format(customEndDate, "yyyy-MM-dd"),
      isPublished: false,
      createdBy: user?.id,
    };
    
    console.log("🏗️ Creazione nuovo schedule con il sistema migliorato:", newScheduleData);
    
    // FASE 2: INVOCAZIONE ENDPOINT MIGLIORATO
    // Usa il nuovo endpoint che garantisce la pulizia completa e l'unicità
    createScheduleMutation.mutate(newScheduleData, {
      onSuccess: async (response) => {
        try {
          // Converti la risposta in JSON
          const data = await response.json();
          console.log("✅ CREAZIONE SCHEDULE COMPLETATA:", data);
          
          // Imposta esplicitamente l'ID della pianificazione corrente
          setCurrentScheduleId(data.id);
          
          // Forza il reset completo della griglia
          setForceResetGrid(true);
          
          // Pre-carica lo schedule nella cache di React Query
          queryClient.setQueryData(["/api/schedules", { id: data.id }], data);
          
          // Notifica all'utente
          toast({
            title: "Turno creato con successo",
            description: "Caricamento della tabella completamente vuota...",
          });
          
          // FASE 3: AGGIORNAMENTO INTERFACCIA
          // Usa un timeout per garantire che la UI sia aggiornata correttamente
          setTimeout(() => {
            // Invalida le query per caricare dati freschi
            queryClient.invalidateQueries({ queryKey: ["/api/schedules/all"] });
            queryClient.invalidateQueries({ queryKey: ["/api/schedules", { id: data.id }] });
            
            console.log("🧹 Pulizia e ricaricamento tabella vuota per ID:", data.id);
            
            // Aggiungi un timestamp per evitare cache del browser
            const timestamp = Date.now();
            
            // FASE 4: REDIRECT CON PARAMETRI MIGLIORATI
            // Usa parametri URL più espliciti e aggiungi currentScheduleId in modo esplicito
            window.location.href = `/schedule?reset=true&id=${data.id}&scheduleId=${data.id}&currentScheduleId=${data.id}&newSchedule=${data.id}&date=${format(customStartDate!, "yyyy-MM-dd")}&forceEmpty=true&refreshed=true&ts=${timestamp}`;
          }, 1000);
        } catch (err) {
          console.error("❌ Errore nella gestione dello schedule:", err);
          toast({
            title: "Errore di elaborazione",
            description: "Problema nel caricamento del nuovo turno. Riprova tra qualche secondo.",
            variant: "destructive"
          });
        }
      },
      onError: (error) => {
        console.error("❌ Errore nella creazione dello schedule:", error);
        toast({
          title: "Errore",
          description: "Impossibile creare la pianificazione. Verificare le date e riprovare.",
          variant: "destructive",
        });
        // Reset dello stato
        setCreatingNewSchedule(false);
        setShowScheduleBuilder(false);
      }
    });
  };

  // Funzione per recuperare i turni di uno schedule specifico
  const fetchShiftsForSchedule = async (scheduleId: number): Promise<any[]> => {
    try {
      const response = await fetch(`/api/schedules/${scheduleId}/shifts`);
      if (!response.ok) {
        throw new Error(`Errore nel recuperare i turni per lo schedule ${scheduleId}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Errore nel recuperare i turni per lo schedule ${scheduleId}:`, error);
      return [];
    }
  };

  // Funzione per aprire il dialogo di esportazione PDF di tutte le settimane
  const handleExportAllToPdf = () => {
    setShowExportPdfDialog(true);
  };
  
  // Handle PDF export per la settimana corrente
  const handleExportPdf = () => {
    if (!existingSchedule || !users || !shifts) return;
    
    // Create PDF content
    let pdfContent = `
      <html>
      <head>
        <title>Pianificazione Turni</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .header { display: flex; justify-content: space-between; }
          .working { background-color: #e6f7ff; }
          .vacation { background-color: #f6ffed; }
          .leave { background-color: #fff2e8; }
          .legend { margin: 10px 0; display: flex; gap: 15px; }
          .legend-item { display: flex; align-items: center; font-size: 12px; }
          .legend-color { display: inline-block; width: 16px; height: 16px; margin-right: 5px; border: 1px solid #ccc; }
          .name-cell { width: 150px; }
          .total-cell { width: 80px; }
        </style>
      </head>
      <body>
        <h1>Pianificazione Turni: ${format(new Date(existingSchedule.startDate), "d MMMM", { locale: it })} - ${format(new Date(existingSchedule.endDate), "d MMMM yyyy", { locale: it })}</h1>
        
        <div class="header">
          <div>
            <p>Data: ${format(new Date(), "dd/MM/yyyy")}</p>
            <p>Stato: ${existingSchedule.isPublished ? 'Pubblicato' : 'Bozza'}</p>
          </div>
        </div>
        
        <div class="legend">
          <div class="legend-item"><span class="legend-color working"></span> In servizio (X)</div>
          <div class="legend-item"><span class="legend-color vacation"></span> Ferie (F)</div>
          <div class="legend-item"><span class="legend-color leave"></span> Permesso (P)</div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th class="name-cell">Dipendente</th>
              <th>Lunedì</th>
              <th>Martedì</th>
              <th>Mercoledì</th>
              <th>Giovedì</th>
              <th>Venerdì</th>
              <th>Sabato</th>
              <th>Domenica</th>
              <th class="total-cell">Totale Ore</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    // Add employee rows with shift summary
    users
      .filter((user: any) => user.role === "employee" && user.isActive)
      .forEach((user: any) => {
        let userTotalHours = 0;
        
        pdfContent += `
          <tr>
            <td class="name-cell">${user.fullName || user.username}</td>
        `;
        
        // Add days of week
        ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'].forEach(day => {
          // Mappatura tra il nome del giorno e il formato yyyy-MM-dd
          const dayIndex = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'].indexOf(day);
          if (dayIndex === -1) return;
          
          const dateObj = new Date(existingSchedule.startDate);
          dateObj.setDate(dateObj.getDate() + dayIndex);
          const formattedDate = format(dateObj, "yyyy-MM-dd");
          
          const userShifts = shifts.filter((s: any) => s.userId === user.id && s.day === formattedDate);
          let daySummary = '-';
          let cellClass = '';
          
          if (userShifts.length > 0) {
            // Sort shifts by start time
            userShifts.sort((a: any, b: any) => {
              return a.startTime.localeCompare(b.startTime);
            });
            
            // Get first and last shift
            const firstShift = userShifts[0];
            const lastShift = userShifts[userShifts.length - 1];
            
            // Determine shift type for cell color
            if (firstShift.type === 'work') {
              cellClass = 'working';
              daySummary = `${firstShift.startTime} - ${lastShift.endTime}`;
              
              // Calculate hours for this day using utility function
              let dayHours = 0;
              userShifts.forEach(shift => {
                dayHours += calculateWorkHours(shift.startTime, shift.endTime);
              });
              
              // Add to total
              userTotalHours += dayHours;
            } else if (firstShift.type === 'vacation') {
              cellClass = 'vacation';
              daySummary = 'Ferie';
            } else if (firstShift.type === 'leave') {
              cellClass = 'leave';
              daySummary = 'Permesso';
            }
          }
          
          pdfContent += `<td class="${cellClass}">${daySummary}</td>`;
        });
        
        // Add total hours with proper formatting
        pdfContent += `<td class="total-cell">${formatHours(userTotalHours)}</td></tr>`;
      });
    
    pdfContent += `
          </tbody>
        </table>
      </body>
      </html>
    `;
    
    // Create a blob and download
    const blob = new Blob([pdfContent], { type: 'text/html' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `pianificazione_${format(new Date(existingSchedule.startDate), "yyyy-MM-dd")}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <span className="material-icons text-primary animate-spin text-4xl">sync</span>
          <p className="mt-4 text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <WeekSelectorDialog 
          open={showWeekSelector}
          onOpenChange={setShowWeekSelector}
          schedules={allSchedules || []}
          onSelectSchedule={handleSelectSchedule}
        />
        
        {isScheduleLoading || isUsersLoading || isShiftsLoading ? (
          <div className="flex items-center justify-center h-64 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="text-center">
              <span className="material-icons text-primary animate-spin text-4xl">sync</span>
              <p className="mt-4 text-gray-600">Caricamento pianificazione...</p>
            </div>
          </div>
        ) : showScheduleBuilder && !existingSchedule ? (
          <div>
            <ExcelGrid
              scheduleId={null}
              users={users || []}
              startDate={selectedWeek}
              endDate={endOfWeek}
              shifts={[]}
              timeOffRequests={timeOffRequests || []}
              isPublished={false}
              onPublish={() => {}}
            />
          </div>
        ) : existingSchedule && !showDatePicker && !creatingNewSchedule ? (
          <div>
            <ExcelGrid
              scheduleId={existingSchedule?.id || null}
              users={users || []}
              startDate={existingSchedule?.startDate ? new Date(existingSchedule.startDate) : selectedWeek}
              endDate={existingSchedule?.endDate ? new Date(existingSchedule.endDate) : endOfWeek}
              shifts={shifts || []}
              timeOffRequests={timeOffRequests || []}
              isPublished={existingSchedule?.isPublished || false}
              onPublish={handlePublish}
              forceResetGrid={forceResetGrid || isLoadingNewSchedule}
            />
            
            {/* Dialogo di esportazione PDF */}
            <ExportToPdfDialog
              open={showExportPdfDialog}
              onOpenChange={setShowExportPdfDialog}
              schedules={allSchedules || []}
              users={users || []}
              fetchShifts={fetchShiftsForSchedule}
            />
            
            {/* Pulsanti di azione posizionati sotto la tabella */}
            <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-4 mt-6 pt-4 border-t border-gray-200">
              <Button
                variant="outline"
                size="sm"
                onClick={handleChangeWeek}
                className="text-xs sm:text-sm"
              >
                <span className="material-icons text-xs sm:text-sm mr-1">history</span>
                Cronologia turni
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewWeeklySchedule}
                className="text-xs sm:text-sm"
              >
                <span className="material-icons text-xs sm:text-sm mr-1">add</span>
                Nuovo turno settimanale
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPdf}
                className="text-xs sm:text-sm"
              >
                <span className="material-icons text-xs sm:text-sm mr-1">download</span>
                Esporta PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportAllToPdf}
                className="text-xs sm:text-sm"
              >
                <span className="material-icons text-xs sm:text-sm mr-1">file_download</span>
                Esporta tutte le settimane
              </Button>
            </div>
          </div>
        ) : (
          <div>
            {showDatePicker ? (
              <Card className="bg-white border border-gray-200">
                <CardHeader>
                  <CardTitle>Seleziona il periodo della pianificazione</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                    <div>
                      <Label className="mb-2 block">Data di inizio</Label>
                      <Calendar
                        mode="single"
                        selected={customStartDate ?? undefined}
                        onSelect={(date: Date | undefined) => handleDateChange('start', date || null)}
                        disabled={(date) => 
                          date < new Date()
                        }
                        className="border border-gray-200 rounded-md"
                      />
                      <div className="text-sm text-gray-500 mt-1">
                        {customStartDate ? format(customStartDate, "EEEE d MMMM yyyy", { locale: it }) : "Seleziona una data"}
                      </div>
                    </div>
                    <div>
                      <Label className="mb-2 block">Data di fine</Label>
                      <Calendar
                        mode="single"
                        selected={customEndDate ?? undefined}
                        onSelect={(date: Date | undefined) => handleDateChange('end', date || null)}
                        disabled={(date) => 
                          !customStartDate || date < customStartDate
                        }
                        className="border border-gray-200 rounded-md"
                      />
                      <div className="text-sm text-gray-500 mt-1">
                        {customEndDate ? format(customEndDate, "EEEE d MMMM yyyy", { locale: it }) : "Seleziona una data"}
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="justify-between border-t px-6 py-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowDatePicker(false)}
                  >
                    Annulla
                  </Button>
                  <Button 
                    onClick={handleCreateSchedule}
                    disabled={!customStartDate || !customEndDate}
                  >
                    Crea Pianificazione
                  </Button>
                </CardFooter>
              </Card>
            ) : (
              <Card className="bg-white border border-gray-200">
                <CardHeader>
                  <CardTitle>Pianificazione Turni</CardTitle>
                </CardHeader>
                <CardContent className="text-center py-12">
                  <div className="mb-6">
                    <span className="material-icons text-primary text-6xl mb-4">calendar_month</span>
                    <h3 className="text-lg font-medium mb-2">Nessuna pianificazione attiva</h3>
                    <p className="text-gray-500 max-w-md mx-auto mb-8">
                      Non esiste ancora una pianificazione per la settimana corrente. Crea una nuova pianificazione per gestire i turni del personale.
                    </p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button
                      onClick={() => setShowDatePicker(true)}
                      className="flex items-center gap-2"
                    >
                      <span className="material-icons">add</span>
                      Crea Nuova Pianificazione
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleAutoGenerate}
                      className="flex items-center gap-2"
                    >
                      <span className="material-icons">auto_fix_high</span>
                      Genera Automaticamente
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
      
      {/* Automatic Schedule Generator Dialog */}
      {/* Dialog per generazione automatica */}
      <Dialog open={showAutoGenerator} onOpenChange={setShowAutoGenerator}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Generazione Automatica Turni</DialogTitle>
          </DialogHeader>
          <ScheduleAutoGenerator
            onScheduleGenerated={(scheduleData) => {
              setShowAutoGenerator(false);
              queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
            }}
          />
        </DialogContent>
      </Dialog>
      
      {/* Dialog per selezionare una settimana dallo storico */}
      <WeekSelectorDialog
        open={showWeekSelector}
        onOpenChange={setShowWeekSelector}
        schedules={allSchedules}
        onSelectSchedule={handleSelectSchedule}
      />
    </Layout>
  );
}