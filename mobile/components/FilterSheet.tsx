import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import type { ListingFilters } from '@/types';

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: ListingFilters;
  onApply: (filters: ListingFilters) => void;
}

const SORT_OPTIONS = [
  { label: 'Newest First', value: 'newest' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'Shortest First', value: 'length_asc' },
] as const;

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: Colors.primary, marginBottom: 10 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function RangeInput({
  minValue, maxValue,
  onMinChange, onMaxChange,
  minPlaceholder, maxPlaceholder,
  prefix,
}: {
  minValue: string; maxValue: string;
  onMinChange: (v: string) => void; onMaxChange: (v: string) => void;
  minPlaceholder: string; maxPlaceholder: string;
  prefix?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 10, height: 44, backgroundColor: '#F9FAFB' }}>
        {prefix && <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 14, color: Colors.muted, marginRight: 2 }}>{prefix}</Text>}
        <TextInput
          value={minValue}
          onChangeText={onMinChange}
          placeholder={minPlaceholder}
          keyboardType="numeric"
          placeholderTextColor={Colors.mutedLight}
          style={{ flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 14, color: Colors.text }}
        />
      </View>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: Colors.muted }}>–</Text>
      </View>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 10, height: 44, backgroundColor: '#F9FAFB' }}>
        {prefix && <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 14, color: Colors.muted, marginRight: 2 }}>{prefix}</Text>}
        <TextInput
          value={maxValue}
          onChangeText={onMaxChange}
          placeholder={maxPlaceholder}
          keyboardType="numeric"
          placeholderTextColor={Colors.mutedLight}
          style={{ flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 14, color: Colors.text }}
        />
      </View>
    </View>
  );
}

export default function FilterSheet({ visible, onClose, filters, onApply }: FilterSheetProps) {
  const [local, setLocal] = useState(filters);

  useEffect(() => {
    if (visible) setLocal(filters);
  }, [visible]);

  const set = (patch: Partial<ListingFilters>) => setLocal((prev) => ({ ...prev, ...patch }));

  const handleReset = () => setLocal({});

  const handleApply = () => onApply(local);

  const activeCount = Object.values(local).filter((v) => v !== undefined && v !== '').length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'formSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.white }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: Colors.border,
          }}
        >
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 17, color: Colors.primary }}>
            Filters
          </Text>
          <TouchableOpacity onPress={handleReset}>
            <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 14, color: Colors.danger }}>
              Reset
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          {/* Sort */}
          <FilterSection title="Sort By">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SORT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => set({ sort_by: local.sort_by === opt.value ? undefined : opt.value })}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    borderWidth: 1.5,
                    borderColor: local.sort_by === opt.value ? Colors.accent : Colors.border,
                    backgroundColor: local.sort_by === opt.value ? '#F0FBFD' : Colors.white,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Poppins_500Medium',
                      fontSize: 13,
                      color: local.sort_by === opt.value ? Colors.accent : Colors.muted,
                    }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </FilterSection>

          {/* Price */}
          <FilterSection title="Price Range">
            <RangeInput
              minValue={local.min_price ? String(local.min_price) : ''}
              maxValue={local.max_price ? String(local.max_price) : ''}
              onMinChange={(v) => set({ min_price: v ? Number(v) : undefined })}
              onMaxChange={(v) => set({ max_price: v ? Number(v) : undefined })}
              minPlaceholder="Min"
              maxPlaceholder="Max"
              prefix="$"
            />
          </FilterSection>

          {/* Year */}
          <FilterSection title="Year">
            <RangeInput
              minValue={local.min_year ? String(local.min_year) : ''}
              maxValue={local.max_year ? String(local.max_year) : ''}
              onMinChange={(v) => set({ min_year: v ? Number(v) : undefined })}
              onMaxChange={(v) => set({ max_year: v ? Number(v) : undefined })}
              minPlaceholder="From"
              maxPlaceholder="To"
            />
          </FilterSection>

          {/* Length */}
          <FilterSection title="Length (ft)">
            <RangeInput
              minValue={local.min_length ? String(local.min_length) : ''}
              maxValue={local.max_length ? String(local.max_length) : ''}
              onMinChange={(v) => set({ min_length: v ? Number(v) : undefined })}
              onMaxChange={(v) => set({ max_length: v ? Number(v) : undefined })}
              minPlaceholder="Min"
              maxPlaceholder="Max"
            />
          </FilterSection>

          {/* Make */}
          <FilterSection title="Make / Brand">
            <View style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, height: 44, backgroundColor: '#F9FAFB', justifyContent: 'center' }}>
              <TextInput
                value={local.make ?? ''}
                onChangeText={(v) => set({ make: v || undefined })}
                placeholder="e.g. Sunseeker, Azimut…"
                placeholderTextColor={Colors.mutedLight}
                style={{ fontFamily: 'Poppins_400Regular', fontSize: 14, color: Colors.text }}
              />
            </View>
          </FilterSection>

          {/* Location */}
          <FilterSection title="Location">
            <View style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, height: 44, backgroundColor: '#F9FAFB', justifyContent: 'center' }}>
              <TextInput
                value={local.location ?? ''}
                onChangeText={(v) => set({ location: v || undefined })}
                placeholder="e.g. Miami, Fort Lauderdale…"
                placeholderTextColor={Colors.mutedLight}
                style={{ fontFamily: 'Poppins_400Regular', fontSize: 14, color: Colors.text }}
              />
            </View>
          </FilterSection>
        </ScrollView>

        {/* Apply button */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border }}>
          <TouchableOpacity
            onPress={handleApply}
            style={{
              height: 52,
              backgroundColor: Colors.primary,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: Colors.white, fontFamily: 'Poppins_600SemiBold', fontSize: 16 }}>
              Show Results{activeCount > 0 ? ` · ${activeCount} filter${activeCount > 1 ? 's' : ''} active` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
