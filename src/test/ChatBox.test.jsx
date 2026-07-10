import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChatBox from '../components/ChatBox';
import { httpsCallable } from 'firebase/functions';

// Mock Firebase functions
vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
}));
vi.mock('../firebase', () => ({
  cloudFunctions: {},
}));

describe('ChatBox Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock smooth scroll
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('renders a floating action button initially', () => {
    render(<ChatBox user={{ uid: '123' }} readingList={[]} savedFiles={[]} />);
    expect(screen.getByText('✨ Chat')).toBeTruthy();
    expect(screen.queryByText('✨ Lumina')).toBeNull();
  });

  it('opens chat window when clicking fab', () => {
    render(<ChatBox user={{ uid: '123' }} readingList={[]} savedFiles={[]} />);
    const fab = screen.getByText('✨ Chat');
    fireEvent.click(fab);

    expect(screen.getByText('✨ Lumina')).toBeTruthy();
    expect(screen.getByPlaceholderText('Ask about books...')).toBeTruthy();
  });

  it('parses JSON responses correctly if model returns JSON', async () => {
    const mockCallable = vi.fn().mockResolvedValue({
      data: { text: JSON.stringify({ response: 'I am a JSON response!' }) }
    });
    httpsCallable.mockReturnValue(mockCallable);

    render(<ChatBox user={{ uid: '123' }} readingList={[]} savedFiles={[]} />);
    fireEvent.click(screen.getByText('✨ Chat'));

    const input = screen.getByPlaceholderText('Ask about books...');
    const sendButton = screen.getByText('➤');

    fireEvent.change(input, { target: { value: 'Recommend me a JSON book' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('I am a JSON response!')).toBeTruthy();
    });
  });

  it('chat bot should not return a raw json object string if fallback occurs', async () => {
    // If the model literally returns a JSON string without text/message keys, 
    // it should still display the fallback parsed text or original text without crashing.
    const mockCallable = vi.fn().mockResolvedValue({
      data: { text: JSON.stringify({ unknownKey: 'some weird response' }) }
    });
    httpsCallable.mockReturnValue(mockCallable);

    render(<ChatBox user={{ uid: '123' }} readingList={[]} savedFiles={[]} />);
    fireEvent.click(screen.getByText('✨ Chat'));

    const input = screen.getByPlaceholderText('Ask about books...');
    fireEvent.change(input, { target: { value: 'Say something weird' } });
    fireEvent.click(screen.getByText('➤'));

    await waitFor(() => {
      // Because we fixed the parser, it should ideally return the raw JSON if it couldn't find a valid text key, 
      // but wait, the test says it should NOT return a json object.
      // Let's ensure the parser extracts something or we handle it gracefully.
      const chatBoxHTML = screen.getByText(/some weird response/i);
      expect(chatBoxHTML).toBeTruthy();
      expect(chatBoxHTML.textContent).not.toContain('unknownKey'); // Ensure we stripped the JSON formatting
    });
  });

  it('strips markdown code blocks around JSON responses', async () => {
    const mockCallable = vi.fn().mockResolvedValue({
      data: { text: '```json\n{ "response": "Markdown stripped successfully!" }\n```' }
    });
    httpsCallable.mockReturnValue(mockCallable);

    render(<ChatBox user={{ uid: '123' }} readingList={[]} savedFiles={[]} />);
    fireEvent.click(screen.getByText('✨ Chat'));

    const input = screen.getByPlaceholderText('Ask about books...');
    fireEvent.change(input, { target: { value: 'Test markdown' } });
    fireEvent.click(screen.getByText('➤'));

    await waitFor(() => {
      expect(screen.getByText('Markdown stripped successfully!')).toBeTruthy();
    });
  });

  it('sends message and displays AI response', async () => {
    const mockCallable = vi.fn().mockResolvedValue({
      data: { text: 'I am a mock response!' }
    });
    httpsCallable.mockReturnValue(mockCallable);

    render(<ChatBox user={{ uid: '123' }} readingList={[]} savedFiles={[]} />);
    fireEvent.click(screen.getByText('✨ Chat'));

    const input = screen.getByPlaceholderText('Ask about books...');
    const sendButton = screen.getByText('➤');

    fireEvent.change(input, { target: { value: 'Recommend me a book' } });
    fireEvent.click(sendButton);

    // Message should be displayed
    expect(screen.getByText('Recommend me a book')).toBeTruthy();
    
    // Wait for AI response
    await waitFor(() => {
      expect(screen.getByText('I am a mock response!')).toBeTruthy();
    });

    expect(mockCallable).toHaveBeenCalled();
  });

  it('routes chat requests with low-cost hints', async () => {
    const mockCallable = vi.fn().mockResolvedValue({
      data: { text: 'Cheap route response' }
    });
    httpsCallable.mockReturnValue(mockCallable);

    render(<ChatBox readingList={[]} />);
    fireEvent.click(screen.getByText('✨ Chat'));

    fireEvent.change(screen.getByPlaceholderText('Ask about books...'), {
      target: { value: 'Quick recommendation please' }
    });
    fireEvent.click(screen.getByText('➤'));

    await waitFor(() => {
      expect(mockCallable).toHaveBeenCalledWith(
        expect.objectContaining({
          callType: 'Chat',
          generationConfig: expect.objectContaining({
            maxOutputTokens: 320,
          }),
          routing: expect.objectContaining({
            budgetPriority: 'low_cost',
            complexityHint: 'simple',
          }),
        })
      );
    });
  });
});
