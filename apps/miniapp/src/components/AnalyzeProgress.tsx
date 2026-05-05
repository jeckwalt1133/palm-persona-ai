import { View, Text } from '@tarojs/components';
import { useState, useEffect } from 'react';
import './AnalyzeProgress.scss';

const STEPS = [
  { key: 'upload', label: '读取你的掌纹' },
  { key: 'extract', label: '找到线条里的秘密' },
  { key: 'analyze', label: '拼出你的性格拼图' },
  { key: 'match', label: '寻找最匹配的人格' },
  { key: 'report', label: '生成专属解读' },
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

      <Text className="ap-title">AI 正在仔细读你的手掌...</Text>

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

      <Text className="ap-footer">每条线都在认真看——第一次见面，它想认真一点</Text>
    </View>
  );
}
