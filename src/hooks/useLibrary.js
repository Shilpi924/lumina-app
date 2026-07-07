import { useState, useRef, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { getBookKey, getSavedFileKey } from "../utils/stringUtils";

export const DEFAULT_FOLDERS = ["Want to read", "For kids", "Gift ideas"];

export function useLibrary({ setSaveStatus }) {
  const [readingList, setReadingList] = useState([]);
  const [savedFiles, setSavedFiles] = useState([]);
  const [folders, setFolders] = useState(DEFAULT_FOLDERS);
  const [bookFolders, setBookFolders] = useState({});
  const [bookTags, setBookTags] = useState({});
  const [activeFolder, setActiveFolder] = useState("All");
  const [activeTagFilter, setActiveTagFilter] = useState(null);
  
  const savedFileIdsRef = useRef(new Set(savedFiles.map((file) => file.id)));

  useEffect(() => {
    savedFileIdsRef.current = new Set(savedFiles.map((file) => file.id));
  }, [savedFiles]);

  function isBookInReadingList(book) {
    if (!book) return false;
    const bookKey = getBookKey(book);
    return readingList.some(
      (savedBook) => getBookKey(savedBook) === bookKey
    );
  }

  function hasSavedPreview(book) {
    return savedFiles.some(
      (file) =>
        file.type === "preview" &&
        file.id === getSavedFileKey(book?.title, "preview")
    );
  }

  function hasSavedDetails(book) {
    return savedFiles.some(
      (file) =>
        file.type === "details" &&
        file.id === getSavedFileKey(book?.title, "details")
    );
  }

  async function cacheBookCoverOffline(book) {
    if (!book.coverUrl || book.coverUrl.startsWith('capacitor://') || book.coverUrl.startsWith('data:')) {
      return book.coverUrl;
    }
    
    try {
      const fileName = `cover_${getBookKey(book).replace(/[^a-z0-9]/gi, '_')}.jpg`;
      const response = await fetch(book.coverUrl);
      const blob = await response.blob();
      
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });

      await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Data,
      });
      
      const { uri } = await Filesystem.getUri({
        path: fileName,
        directory: Directory.Data,
      });

      return Capacitor.convertFileSrc(uri);
    } catch (e) {
      console.warn("Could not cache book cover", e);
      return book.coverUrl;
    }
  }

  async function toggleReadingList(book) {
    if (!book) return;

    const exists = isBookInReadingList(book);
    const bookKey = getBookKey(book);

    setReadingList((currentList) =>
      exists
        ? currentList.filter((savedBook) => getBookKey(savedBook) !== bookKey)
        : [{ ...book, savedAt: new Date().toISOString() }, ...currentList]
    );

    if (!exists) {
      const cachedCoverUrl = await cacheBookCoverOffline(book);
      if (cachedCoverUrl !== book.coverUrl) {
        setReadingList((currentList) =>
          currentList.map((b) =>
            getBookKey(b) === bookKey ? { ...b, coverUrl: cachedCoverUrl } : b
          )
        );
      }
    }

    if (exists) {
      const bookTitle = book.title;
      const detailsKey = getSavedFileKey(bookTitle, "details");
      const previewKey = getSavedFileKey(bookTitle, "preview");
      setSavedFiles((currentFiles) =>
        currentFiles.filter((file) => file.id !== detailsKey && file.id !== previewKey)
      );
    }

    setBookFolders((currentFolders) => {
      if (exists) {
        const nextFolders = { ...currentFolders };
        delete nextFolders[bookKey];
        return nextFolders;
      }
      return { ...currentFolders, [bookKey]: currentFolders[bookKey] || "Want to read" };
    });

    if (setSaveStatus) {
      setSaveStatus({
        message: exists
          ? `${book.title} removed from favorites.`
          : `${book.title} added to favorites.`,
        bookKey: getSavedFileKey(book.title, "favorite"),
        type: "favorite",
      });
    }
  }

  function assignBookFolder(book, folderName) {
    const bookKey = getBookKey(book);
    if (!bookKey) return;

    setBookFolders((currentFolders) => ({
      ...currentFolders,
      [bookKey]: folderName,
    }));
  }

  function deleteFolder(folderName) {
    if (window.confirm(`Are you sure you want to delete the folder "${folderName}"? All books in it will be moved back to "Want to read".`)) {
      setFolders((current) => current.filter((f) => f !== folderName));
      if (activeFolder === folderName) {
        setActiveFolder("All");
      }
      setBookFolders((current) => {
        const updated = { ...current };
        Object.keys(updated).forEach((key) => {
          if (updated[key] === folderName) {
            delete updated[key];
          }
        });
        return updated;
      });
      if (setSaveStatus) {
        setSaveStatus({
          message: `Folder "${folderName}" was deleted.`,
          bookKey: "folder",
          type: "folder",
        });
      }
    }
  }

  function toggleBookTag(bookKey, tag) {
    setBookTags(currentTags => {
      const tagsForBook = currentTags[bookKey] || [];
      const isTagPresent = tagsForBook.includes(tag);
      const newTags = isTagPresent ? tagsForBook.filter(t => t !== tag) : [...tagsForBook, tag];
      return { ...currentTags, [bookKey]: newTags };
    });
  }

  function saveLocalPreviewFile(fileName, payload, bookTitle, displayName, type) {
    const savedAt = new Date().toISOString();
    const savedKey = getSavedFileKey(bookTitle, type);
    const savedFile = {
      id: savedKey,
      name: displayName || fileName,
      bookTitle,
      location: "This phone",
      savedAt,
      type,
      payload,
    };
    const alreadySaved = savedFileIdsRef.current.has(savedKey);

    if (alreadySaved) {
      setSavedFiles((currentFiles) =>
        currentFiles.map((file) =>
          file.id === savedKey ? { ...file, ...savedFile } : file
        )
      );
    } else {
      savedFileIdsRef.current.add(savedKey);
      setSavedFiles((currentFiles) => [savedFile, ...currentFiles]);
    }

    if (setSaveStatus) {
      setSaveStatus({
        message: alreadySaved
          ? `Updated ${displayName || fileName} on this phone.`
          : `Saved ${displayName || fileName} on this phone.`,
        bookKey: savedKey,
        type,
      });
    }
  }

  return {
    readingList, setReadingList,
    savedFiles, setSavedFiles,
    folders, setFolders,
    bookFolders, setBookFolders,
    bookTags, setBookTags,
    activeFolder, setActiveFolder,
    activeTagFilter, setActiveTagFilter,
    isBookInReadingList,
    hasSavedPreview,
    hasSavedDetails,
    toggleReadingList,
    assignBookFolder,
    deleteFolder,
    toggleBookTag,
    saveLocalPreviewFile,
  };
}
