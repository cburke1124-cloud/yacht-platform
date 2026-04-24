import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, { SlideInRight, SlideInLeft } from 'react-native-reanimated';
import { dealerApi, mediaApi, listingsApi } from '@/lib/api';
import { Colors } from '@/constants/colors';
import type { Listing } from '@/types';

// ─── Schema ───────────────────────────────────────────────────────────────────
const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.string().optional(),
  price: z.string().optional(),
  status: z.enum(['draft', 'active']),
  condition: z.enum(['used', 'new']),
  length_feet: z.string().optional(),
  boat_type: z.string().optional(),
  hull_material: z.string().optional(),
  fuel_type: z.string().optional(),
  engine_hours: z.string().optional(),
  cabins: z.string().optional(),
  berths: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Constants ────────────────────────────────────────────────────────────────
const BOAT_TYPES = [
  'Motor Yacht', 'Sailing Yacht', 'Catamaran', 'Sport Fish',
  'Center Console', 'Trawler', 'PWC', 'Other',
];
const HULL_MATERIALS = ['Fiberglass', 'Aluminum', 'Steel', 'Wood', 'Carbon Fiber', 'Ferro-Cement'];
const FUEL_TYPES = ['Diesel', 'Gas', 'Electric', 'Hybrid'];
const STEP_TITLES = ['Photos', 'Basics', 'Specs', 'Review'];

type PhotoItem =
  | { type: 'existing'; id: number; url: string }
  | { type: 'new'; uri: string; localKey: string };

// ─── Shared UI ────────────────────────────────────────────────────────────────
function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 13, color: Colors.muted, marginBottom: 6 }}>
      {children}
      {required && <Text style={{ color: Colors.danger }}> *</Text>}
    </Text>
  );
}

function StyledInput({
  value, onChangeText, placeholder, keyboardType, multiline, style, ...rest
}: React.ComponentProps<typeof TextInput>) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.mutedLight}
      keyboardType={keyboardType}
      multiline={multiline}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        {
          fontFamily: 'Poppins_400Regular',
          fontSize: 15,
          color: Colors.text,
          borderWidth: 1.5,
          borderColor: focused ? Colors.accent : Colors.border,
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 12,
          backgroundColor: Colors.white,
        },
        multiline && { height: 130, textAlignVertical: 'top' as const },
        style as any,
      ]}
      {...rest}
    />
  );
}

function PillSelector({
  options, value, onChange,
}: { options: string[]; value?: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((opt) => {
        const selected = value?.toLowerCase() === opt.toLowerCase();
        return (
          <TouchableOpacity
            key={opt}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(selected ? '' : opt.toLowerCase());
            }}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 20,
              borderWidth: 1.5,
              borderColor: selected ? Colors.accent : Colors.border,
              backgroundColor: selected ? `${Colors.accent}18` : Colors.white,
            }}
          >
            <Text style={{
              fontFamily: 'Poppins_500Medium',
              fontSize: 13,
              color: selected ? Colors.accent : Colors.muted,
            }}>
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function StatusToggle({
  value, onChange,
}: { value: 'draft' | 'active'; onChange: (v: 'draft' | 'active') => void }) {
  return (
    <View style={{
      flexDirection: 'row',
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1.5,
      borderColor: Colors.border,
      backgroundColor: Colors.background,
    }}>
      {(['draft', 'active'] as const).map((s) => (
        <TouchableOpacity
          key={s}
          onPress={() => { Haptics.selectionAsync(); onChange(s); }}
          style={{
            flex: 1,
            paddingVertical: 11,
            alignItems: 'center',
            backgroundColor: value === s ? Colors.primary : 'transparent',
            margin: value === s ? 2 : 0,
            borderRadius: value === s ? 9 : 0,
          }}
        >
          <Text style={{
            fontFamily: 'Poppins_600SemiBold',
            fontSize: 13,
            color: value === s ? Colors.white : Colors.muted,
            textTransform: 'capitalize',
          }}>
            {s}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Step 1: Photos ───────────────────────────────────────────────────────────
function PhotosStep({
  photos, onAdd, onRemove,
}: { photos: PhotoItem[]; onAdd: () => void; onRemove: (i: number) => void }) {
  const canAdd = photos.length < 20;

  return (
    <View>
      <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 22, color: Colors.primary, marginBottom: 6 }}>
        Add Photos
      </Text>
      <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 14, color: Colors.muted, marginBottom: 20 }}>
        The first photo will be your cover image. Add up to 20 photos.
      </Text>

      {photos.length === 0 ? (
        <TouchableOpacity
          onPress={onAdd}
          activeOpacity={0.7}
          style={{
            height: 180,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: Colors.border,
            borderStyle: 'dashed',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: Colors.white,
            gap: 10,
          }}
        >
          <Ionicons name="images-outline" size={44} color={Colors.mutedLight} />
          <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: Colors.muted }}>
            Tap to add photos
          </Text>
          <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 13, color: Colors.mutedLight }}>
            Select from your photo library
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {photos.map((photo, i) => {
            const uri = photo.type === 'existing' ? photo.url : photo.uri;
            const key = photo.type === 'existing' ? `existing-${photo.id}` : photo.localKey;
            return (
              <View key={key} style={{ position: 'relative' }}>
                <Image
                  source={{ uri }}
                  style={{ width: 104, height: 104, borderRadius: 10, backgroundColor: Colors.border }}
                  contentFit="cover"
                />
                {i === 0 && (
                  <View style={{
                    position: 'absolute', bottom: 6, left: 6,
                    backgroundColor: Colors.primary,
                    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
                  }}>
                    <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 10, color: Colors.white }}>
                      COVER
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  onPress={() => onRemove(i)}
                  style={{
                    position: 'absolute', top: 4, right: 4,
                    backgroundColor: 'rgba(0,0,0,0.55)',
                    borderRadius: 12, width: 24, height: 24,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            );
          })}

          {canAdd && (
            <TouchableOpacity
              onPress={onAdd}
              activeOpacity={0.7}
              style={{
                width: 104, height: 104,
                borderRadius: 10,
                borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed',
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: Colors.white,
              }}
            >
              <Ionicons name="add" size={28} color={Colors.mutedLight} />
              <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 12, color: Colors.mutedLight, marginTop: 2 }}>
                Add
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {photos.length > 0 && (
        <View style={{
          flexDirection: 'row', gap: 6, alignItems: 'center',
          marginTop: 16, padding: 12,
          backgroundColor: `${Colors.primary}0C`,
          borderRadius: 10,
        }}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
          <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 12, color: Colors.primary, flex: 1 }}>
            Tap the × to remove a photo. The first photo becomes your cover image.
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Step 2: Basics ───────────────────────────────────────────────────────────
function BasicsStep({ control, errors }: { control: any; errors: any }) {
  return (
    <View>
      <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 22, color: Colors.primary, marginBottom: 6 }}>
        Basic Info
      </Text>
      <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 14, color: Colors.muted, marginBottom: 24 }}>
        Essential details about this vessel.
      </Text>

      {/* Title */}
      <View style={{ marginBottom: 18 }}>
        <FieldLabel required>Listing Title</FieldLabel>
        <Controller
          control={control}
          name="title"
          render={({ field: { value, onChange } }) => (
            <StyledInput
              value={value}
              onChangeText={onChange}
              placeholder="e.g. 2019 Azimut 50 Flybridge"
            />
          )}
        />
        {errors.title && (
          <Text style={{ color: Colors.danger, fontFamily: 'Poppins_400Regular', fontSize: 12, marginTop: 4 }}>
            {errors.title.message}
          </Text>
        )}
      </View>

      {/* Make + Model */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 18 }}>
        <View style={{ flex: 1 }}>
          <FieldLabel>Make</FieldLabel>
          <Controller
            control={control}
            name="make"
            render={({ field: { value, onChange } }) => (
              <StyledInput value={value} onChangeText={onChange} placeholder="Azimut" />
            )}
          />
        </View>
        <View style={{ flex: 1 }}>
          <FieldLabel>Model</FieldLabel>
          <Controller
            control={control}
            name="model"
            render={({ field: { value, onChange } }) => (
              <StyledInput value={value} onChangeText={onChange} placeholder="50 Flybridge" />
            )}
          />
        </View>
      </View>

      {/* Year + Price */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 18 }}>
        <View style={{ flex: 1 }}>
          <FieldLabel>Year</FieldLabel>
          <Controller
            control={control}
            name="year"
            render={({ field: { value, onChange } }) => (
              <StyledInput
                value={value}
                onChangeText={onChange}
                placeholder="2019"
                keyboardType="number-pad"
              />
            )}
          />
        </View>
        <View style={{ flex: 1 }}>
          <FieldLabel>Asking Price (USD)</FieldLabel>
          <Controller
            control={control}
            name="price"
            render={({ field: { value, onChange } }) => (
              <StyledInput
                value={value}
                onChangeText={onChange}
                placeholder="450000"
                keyboardType="decimal-pad"
              />
            )}
          />
        </View>
      </View>

      {/* Status */}
      <View style={{ marginBottom: 4 }}>
        <FieldLabel>Status</FieldLabel>
        <Controller
          control={control}
          name="status"
          render={({ field: { value, onChange } }) => (
            <StatusToggle value={value} onChange={onChange} />
          )}
        />
      </View>
    </View>
  );
}

// ─── Step 3: Specs ────────────────────────────────────────────────────────────
function SpecsStep({ control }: { control: any; errors: any }) {
  return (
    <View>
      <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 22, color: Colors.primary, marginBottom: 6 }}>
        Specifications
      </Text>
      <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 14, color: Colors.muted, marginBottom: 24 }}>
        Help buyers find this listing with the right specs.
      </Text>

      {/* Length */}
      <View style={{ marginBottom: 20 }}>
        <FieldLabel>Length (feet)</FieldLabel>
        <Controller
          control={control}
          name="length_feet"
          render={({ field: { value, onChange } }) => (
            <StyledInput value={value} onChangeText={onChange} placeholder="50" keyboardType="decimal-pad" />
          )}
        />
      </View>

      {/* Boat Type */}
      <View style={{ marginBottom: 22 }}>
        <FieldLabel>Boat Type</FieldLabel>
        <Controller
          control={control}
          name="boat_type"
          render={({ field: { value, onChange } }) => (
            <PillSelector options={BOAT_TYPES} value={value} onChange={onChange} />
          )}
        />
      </View>

      {/* Condition */}
      <View style={{ marginBottom: 22 }}>
        <FieldLabel>Condition</FieldLabel>
        <Controller
          control={control}
          name="condition"
          render={({ field: { value, onChange } }) => (
            <PillSelector
              options={['Used', 'New']}
              value={value}
              onChange={(v) => onChange(v as 'used' | 'new')}
            />
          )}
        />
      </View>

      {/* Hull Material */}
      <View style={{ marginBottom: 22 }}>
        <FieldLabel>Hull Material</FieldLabel>
        <Controller
          control={control}
          name="hull_material"
          render={({ field: { value, onChange } }) => (
            <PillSelector options={HULL_MATERIALS} value={value} onChange={onChange} />
          )}
        />
      </View>

      {/* Fuel Type */}
      <View style={{ marginBottom: 22 }}>
        <FieldLabel>Fuel Type</FieldLabel>
        <Controller
          control={control}
          name="fuel_type"
          render={({ field: { value, onChange } }) => (
            <PillSelector options={FUEL_TYPES} value={value} onChange={onChange} />
          )}
        />
      </View>

      {/* Engine Hours / Cabins / Berths */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
        <View style={{ flex: 1 }}>
          <FieldLabel>Engine Hours</FieldLabel>
          <Controller
            control={control}
            name="engine_hours"
            render={({ field: { value, onChange } }) => (
              <StyledInput value={value} onChangeText={onChange} placeholder="1200" keyboardType="number-pad" />
            )}
          />
        </View>
        <View style={{ flex: 1 }}>
          <FieldLabel>Cabins</FieldLabel>
          <Controller
            control={control}
            name="cabins"
            render={({ field: { value, onChange } }) => (
              <StyledInput value={value} onChangeText={onChange} placeholder="3" keyboardType="number-pad" />
            )}
          />
        </View>
        <View style={{ flex: 1 }}>
          <FieldLabel>Berths</FieldLabel>
          <Controller
            control={control}
            name="berths"
            render={({ field: { value, onChange } }) => (
              <StyledInput value={value} onChangeText={onChange} placeholder="6" keyboardType="number-pad" />
            )}
          />
        </View>
      </View>

      {/* Location */}
      <View style={{ marginBottom: 18 }}>
        <FieldLabel>City</FieldLabel>
        <Controller
          control={control}
          name="city"
          render={({ field: { value, onChange } }) => (
            <StyledInput value={value} onChangeText={onChange} placeholder="Fort Lauderdale" />
          )}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 4 }}>
        <View style={{ flex: 1 }}>
          <FieldLabel>State</FieldLabel>
          <Controller
            control={control}
            name="state"
            render={({ field: { value, onChange } }) => (
              <StyledInput value={value} onChangeText={onChange} placeholder="FL" />
            )}
          />
        </View>
        <View style={{ flex: 1 }}>
          <FieldLabel>Country</FieldLabel>
          <Controller
            control={control}
            name="country"
            render={({ field: { value, onChange } }) => (
              <StyledInput value={value} onChangeText={onChange} placeholder="US" />
            )}
          />
        </View>
      </View>
    </View>
  );
}

// ─── Step 4: Review ───────────────────────────────────────────────────────────
function ReviewStep({
  photos, title, make, model, year, price,
  control, isSubmitting, onSaveDraft, onPublish,
}: {
  photos: PhotoItem[];
  title: string;
  make?: string;
  model?: string;
  year?: string;
  price?: string;
  control: any;
  isSubmitting: boolean;
  onSaveDraft: () => void;
  onPublish: () => void;
}) {
  const coverPhoto = photos[0];
  const coverUri = coverPhoto
    ? coverPhoto.type === 'existing' ? coverPhoto.url : coverPhoto.uri
    : null;
  const parsedPrice = price ? parseFloat(price) : null;

  return (
    <View>
      <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 22, color: Colors.primary, marginBottom: 6 }}>
        Review & Publish
      </Text>
      <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 14, color: Colors.muted, marginBottom: 24 }}>
        Add a description, then save as a draft or publish live.
      </Text>

      {/* Preview card */}
      <View style={{
        backgroundColor: Colors.white,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: 28,
      }}>
        {coverUri ? (
          <Image source={{ uri: coverUri }} style={{ width: '100%', height: 190 }} contentFit="cover" />
        ) : (
          <View style={{ height: 120, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="boat-outline" size={40} color={Colors.mutedLight} />
          </View>
        )}
        <View style={{ padding: 16 }}>
          <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: Colors.text }} numberOfLines={2}>
            {title || 'Untitled Listing'}
          </Text>
          {(year || make || model) && (
            <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 13, color: Colors.muted, marginTop: 4 }}>
              {[year, make, model].filter(Boolean).join(' · ')}
            </Text>
          )}
          {parsedPrice != null && !isNaN(parsedPrice) && (
            <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 20, color: Colors.primary, marginTop: 8 }}>
              ${parsedPrice.toLocaleString()}
            </Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 }}>
            <Ionicons name="images-outline" size={14} color={Colors.muted} />
            <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 12, color: Colors.muted }}>
              {photos.length} photo{photos.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </View>

      {/* Description */}
      <View style={{ marginBottom: 28 }}>
        <FieldLabel>Description</FieldLabel>
        <Controller
          control={control}
          name="description"
          render={({ field: { value, onChange } }) => (
            <StyledInput
              value={value}
              onChangeText={onChange}
              placeholder="Describe this vessel — condition, history, notable features and recent upgrades..."
              multiline
            />
          )}
        />
      </View>

      {/* CTA buttons */}
      <View style={{ gap: 12 }}>
        <TouchableOpacity
          onPress={onPublish}
          disabled={isSubmitting}
          activeOpacity={0.85}
          style={{
            height: 56,
            backgroundColor: isSubmitting ? Colors.mutedLight : Colors.accent,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
          }}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="globe-outline" size={20} color="#fff" />
              <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 16, color: '#fff' }}>
                Publish Listing
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onSaveDraft}
          disabled={isSubmitting}
          activeOpacity={0.85}
          style={{
            height: 56,
            backgroundColor: Colors.white,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: Colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
          }}
        >
          <Ionicons name="save-outline" size={20} color={Colors.primary} />
          <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: Colors.primary }}>
            Save as Draft
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ListingEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const listingId = isNew ? null : parseInt(id, 10);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<'next' | 'prev'>('next');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'draft', condition: 'used' },
  });

  // For edit mode — load existing listing
  const { isLoading: loadingExisting } = useQuery({
    queryKey: ['listing-editor', listingId],
    queryFn: () => listingsApi.getListing(listingId!),
    enabled: !isNew && listingId != null,
    select: (listing: Listing) => {
      // Side-effect: hydrate form once
      setValue('title', listing.title ?? '');
      setValue('make', listing.make ?? '');
      setValue('model', listing.model ?? '');
      setValue('year', listing.year ? String(listing.year) : '');
      setValue('price', listing.price ? String(listing.price) : '');
      setValue('status', (listing.status === 'active' ? 'active' : 'draft'));
      setValue('length_feet', listing.length_ft ? String(listing.length_ft) : '');
      setValue('description', listing.description ?? '');
      setValue('hull_material', (listing.hull_material ?? '').toLowerCase());
      setValue('fuel_type', (listing.fuel_type ?? '').toLowerCase());
      setValue('engine_hours', listing.engine_hours ? String(listing.engine_hours) : '');
      setValue('cabins', listing.cabins ? String(listing.cabins) : '');
      setValue('berths', listing.berths ? String(listing.berths) : '');
      if (listing.media?.length) {
        setPhotos(
          listing.media.map((m) => ({ type: 'existing' as const, id: m.id, url: m.url })),
        );
      }
      return listing;
    },
  });

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDir('next');
    setStep((s) => s + 1);
  };

  const goBack = () => {
    if (step === 0) { router.back(); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDir('prev');
    setStep((s) => s - 1);
  };

  const pickImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: Math.max(1, 20 - photos.length),
    });
    if (!result.canceled) {
      const incoming: PhotoItem[] = result.assets.map((a) => ({
        type: 'new',
        uri: a.uri,
        localKey: `new-${Date.now()}-${Math.random()}`,
      }));
      setPhotos((prev) => [...prev, ...incoming]);
    }
  };

  const removePhoto = (i: number) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setPhotos((prev) => prev.filter((_, idx) => idx !== i));
  };

  const submit = async (data: FormValues, publishNow: boolean) => {
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        title: data.title,
        make: data.make || undefined,
        model: data.model || undefined,
        year: data.year ? parseInt(data.year, 10) : undefined,
        price: data.price ? parseFloat(data.price) : undefined,
        status: publishNow ? 'active' : 'draft',
        condition: data.condition,
        length_feet: data.length_feet ? parseFloat(data.length_feet) : undefined,
        boat_type: data.boat_type || undefined,
        hull_material: data.hull_material || undefined,
        fuel_type: data.fuel_type || undefined,
        engine_hours: data.engine_hours ? parseInt(data.engine_hours, 10) : undefined,
        cabins: data.cabins ? parseInt(data.cabins, 10) : undefined,
        berths: data.berths ? parseInt(data.berths, 10) : undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        country: data.country || undefined,
        description: data.description || undefined,
      };

      let listing: Listing;
      if (isNew) {
        listing = await dealerApi.createListing({ ...payload, bin: `MOBILE-${Date.now()}` });
      } else {
        listing = await dealerApi.updateListing(listingId!, payload);
      }

      // Upload and attach any new photos
      const newPhotos = photos.filter((p) => p.type === 'new') as Extract<PhotoItem, { type: 'new' }>[];
      if (newPhotos.length > 0) {
        const mediaIds: number[] = [];
        for (const p of newPhotos) {
          const media = await mediaApi.uploadPhoto(p.uri, listing.id);
          mediaIds.push(media.id);
        }
        await dealerApi.attachMedia(listing.id, mediaIds);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['listings', 'my'] });
      router.back();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const detail = err?.response?.data?.detail;
      Alert.alert('Error', detail ?? 'Failed to save listing. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = watch('title');
  const make = watch('make');
  const model = watch('model');
  const year = watch('year');
  const price = watch('price');

  if (!isNew && loadingExisting) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* ── Header ── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            justifyContent: 'space-between', marginBottom: 18,
          }}>
            <TouchableOpacity onPress={goBack} hitSlop={10} style={{ padding: 4 }}>
              <Ionicons
                name={step === 0 ? 'close' : 'arrow-back'}
                size={24}
                color={Colors.primary}
              />
            </TouchableOpacity>
            <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 17, color: Colors.primary }}>
              {isNew ? 'New Listing' : 'Edit Listing'}
            </Text>
            <View style={{ width: 32 }} />
          </View>

          {/* Progress bar */}
          <View style={{ flexDirection: 'row', gap: 5 }}>
            {STEP_TITLES.map((_, i) => (
              <View
                key={i}
                style={{
                  flex: 1, height: 3, borderRadius: 2,
                  backgroundColor: i <= step ? Colors.accent : Colors.border,
                }}
              />
            ))}
          </View>
          <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 12, color: Colors.muted, marginTop: 7 }}>
            Step {step + 1} of {STEP_TITLES.length} — {STEP_TITLES[step]}
          </Text>
        </View>

        {/* ── Step content (animated) ── */}
        <Animated.View
          key={step}
          entering={dir === 'next' ? SlideInRight.duration(240) : SlideInLeft.duration(240)}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step === 0 && (
              <PhotosStep photos={photos} onAdd={pickImages} onRemove={removePhoto} />
            )}
            {step === 1 && (
              <BasicsStep control={control} errors={errors} />
            )}
            {step === 2 && (
              <SpecsStep control={control} errors={errors} />
            )}
            {step === 3 && (
              <ReviewStep
                photos={photos}
                title={title}
                make={make}
                model={model}
                year={year}
                price={price}
                control={control}
                isSubmitting={isSubmitting}
                onSaveDraft={handleSubmit((data) => submit(data, false))}
                onPublish={handleSubmit((data) => submit(data, true))}
              />
            )}
          </ScrollView>
        </Animated.View>

        {/* ── Continue button (steps 0–2) ── */}
        {step < 3 && (
          <View style={{
            paddingHorizontal: 16, paddingVertical: 12,
            borderTopWidth: 1, borderTopColor: Colors.border,
            backgroundColor: Colors.white,
          }}>
            <TouchableOpacity
              onPress={() => {
                if (step === 1) {
                  // Validate title before advancing
                  handleSubmit(goNext, () => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                  })();
                } else {
                  goNext();
                }
              }}
              activeOpacity={0.85}
              style={{
                height: 52,
                backgroundColor: Colors.accent,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 6,
              }}
            >
              <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: '#fff' }}>
                Continue
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
