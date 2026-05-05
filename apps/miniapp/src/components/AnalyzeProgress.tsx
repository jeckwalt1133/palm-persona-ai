import { View, Text } from '@tarojs/components';
import { useState, useEffect } from 'react';
import './AnalyzeProgress.scss';

const STEPS = [
  { key: 'upload', label: '看到你的掌纹了' },
  { key: 'extract', label: '这几条线有点意思' },
  { key: 'analyze', label: '拼图快完成了' },
  { key: 'match', label: '找到和你最像的那一类人' },
  { key: 'report', label: '你的专属解读准备好了' },
];

interface Props {
  onComplete: () => void;
}

export default function AnalyzeProgress({ onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [stepsDone, setStepsDone] = useState<boolean[]>([false, false, false, false, false]);

  useEffect(() => {
    if (currentStep >= 5) {
      onComplete();
      return;
    }

    const delay = [600, 1000, 1200, 1000, 800][currentStep];
    const timer = setTimeout(() => {
      setStepsDone((prev) => {
        const next = [...prev];
        next[currentStep] = true;
        return next;
      });
      setCurrentStep((prev) => prev + 1);
    }, delay);

    return () => clearTimeout(timer);
  }, [currentStep, onComplete]);

  return (
    <View className="analyze-progress">
      <View className="ap-pulse-ring">
        <View className="ap-pulse-inner" />
      </View>

      <Text className="ap-title">AI 正在读你的手掌...</Text>

      <View className="ap-steps">
        {STEPS.map((step, i) => (
          <View key={step.key} className={`ap-step ${stepsDone[i] ? 'ap-step-done' : ''} ${i === currentStep ? 'ap-step-active' : ''}`}>
            <View className="ap-step-left">
              <View className={`ap-step-icon-wrap ${stepsDone[i] ? 'ap-icon-done' : i === currentStep ? 'ap-icon-active' : ''}`}>
                {stepsDone[i] ? (
                  <Text className="ap-check">&#10003;</Text>
                ) : (
                  <Text className="ap-step-num">{i + 1}</Text>
                )}
              </View>
              {i < 4 && (
                <View className={`ap-connector ${stepsDone[i] ? 'ap-connector-done' : ''}`} />
              )}
            </View>
            <View className="ap-step-text-wrap">
              <Text className={`ap-step-label ${stepsDone[i] ? 'ap-label-done' : i === currentStep ? 'ap-label-active' : ''}`}>
                {step.label}
              </Text>
              {i === currentStep && (
                <Text className="ap-step-sub">快好了...</Text>
              )}
            </View>
          </View>
        ))}
      </View>

      <Text className="ap-footer">它好像看到了一些有意思的东西...</Text>
    </View>
  );
}
