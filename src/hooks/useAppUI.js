import { useState } from "react";

export const SECTION_DEFAULT_OPEN = {
  scanLimits: true,
  offlineData: true,
  dataManagement: false,
  advanced: false,
  importExport: false,
  appearance: false,
  aiCredits: false,
  dangerZone: false,
};

export function useAppUI() {
  const [folderModal, setFolderModal] = useState({ isOpen: false, book: null, name: "" });
  const [tagModal, setTagModal] = useState({ isOpen: false, bookKey: null });
  const [openShelfLocations, setOpenShelfLocations] = useState({});
  const [compare, setCompare] = useState([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [previewModal, setPreviewModal] = useState(null);
  
  // Discover feed UI
  const [discoverIndex, setDiscoverIndex] = useState(0);
  const [swipeHistory, setSwipeHistory] = useState([]);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [selectedDiscoverFolder, setSelectedDiscoverFolder] = useState("Want to read");

  // Modals & prompts
  const [manualBookForm, setManualBookForm] = useState({
    title: "",
    author: "",
    genre: "",
    readingLevel: "Intermediate",
    rating: "4.0",
    summary: "",
    whyRead: "",
    shelfLocation: "",
    shelfPick: "Popular",
  });
  const [manualBookModalOpen, setManualBookModalOpen] = useState(false);
  const [betaUnlockPopupOpen, setBetaUnlockPopupOpen] = useState(false);
  const [libraryCardLoginPromptOpen, setLibraryCardLoginPromptOpen] = useState(false);
  const [scanLimitPromptOpen, setScanLimitPromptOpen] = useState(false);
  const [openSections, setOpenSections] = useState(SECTION_DEFAULT_OPEN);

  function closeFolderModal() {
    setFolderModal({ isOpen: false, book: null, name: "" });
  }

  function closeTagModal() {
    setTagModal({ isOpen: false, bookKey: null });
  }

  function openManualBookModal() {
    setManualBookForm({
      title: "",
      author: "",
      genre: "",
      readingLevel: "Intermediate",
      rating: "4.0",
      summary: "",
      whyRead: "",
      shelfLocation: "",
      shelfPick: "Popular",
    });
    setManualBookModalOpen(true);
  }

  function closeManualBookModal() {
    setManualBookModalOpen(false);
  }

  function handleManualBookChange(fieldName, value) {
    setManualBookForm((current) => ({
      ...current,
      [fieldName]: value,
    }));
  }

  function toggleSection(sectionKey) {
    setOpenSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));
  }

  return {
    folderModal, setFolderModal,
    tagModal, setTagModal,
    openShelfLocations, setOpenShelfLocations,
    compare, setCompare,
    compareOpen, setCompareOpen,
    previewModal, setPreviewModal,
    manualBookForm, setManualBookForm,
    manualBookModalOpen, setManualBookModalOpen,
    betaUnlockPopupOpen, setBetaUnlockPopupOpen,
    libraryCardLoginPromptOpen, setLibraryCardLoginPromptOpen,
    scanLimitPromptOpen, setScanLimitPromptOpen,
    openSections, setOpenSections,
    discoverIndex, setDiscoverIndex,
    swipeHistory, setSwipeHistory,
    swipeDirection, setSwipeDirection,
    selectedDiscoverFolder, setSelectedDiscoverFolder,
    closeFolderModal,
    closeTagModal,
    openManualBookModal,
    closeManualBookModal,
    handleManualBookChange,
    toggleSection,
  };
}
