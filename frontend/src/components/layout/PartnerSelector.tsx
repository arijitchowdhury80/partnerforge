/**
 * Partner Selector Component
 *
 * Premium branded dropdown for selecting partner and product.
 * Slack/Notion-style grouped dropdown with search.
 */

import { useState, useMemo } from 'react';
import {
  UnstyledButton,
  Text,
  Badge,
  Group,
  Box,
  TextInput,
  ScrollArea,
  Divider,
  Popover,
} from '@mantine/core';
import { IconChevronDown, IconSearch, IconCheck } from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePartner, Partner, Product, getSelectionDisplayName } from '@/contexts/PartnerContext';
import { getPartnerLogo } from '@/components/common/PartnerLogos';

export function PartnerSelector() {
  const { selection, selectPartner, selectProduct, partners } = usePartner();
  const [opened, setOpened] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter partners/products based on search
  const filteredPartners = useMemo(() => {
    if (!searchQuery.trim()) return partners;

    const query = searchQuery.toLowerCase();
    return partners
      .map((partner) => {
        // Check if partner name matches
        const partnerMatches = partner.name.toLowerCase().includes(query);

        // Filter products that match
        const matchingProducts = partner.products.filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.shortName.toLowerCase().includes(query)
        );

        if (partnerMatches) {
          return partner; // Return full partner with all products
        } else if (matchingProducts.length > 0) {
          return { ...partner, products: matchingProducts };
        }
        return null;
      })
      .filter(Boolean) as Partner[];
  }, [partners, searchQuery]);

  const handleSelectPartner = (partner: Partner) => {
    selectPartner(partner);
    setOpened(false);
    setSearchQuery('');
  };

  const handleSelectProduct = (partner: Partner, product: Product) => {
    selectPartner(partner);
    selectProduct(product);
    setOpened(false);
    setSearchQuery('');
  };

  const Logo = getPartnerLogo(selection.partner.key);
  const displayName = getSelectionDisplayName(selection);

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-start"
      width={340}
      shadow="xl"
      radius="lg"
      transitionProps={{ transition: 'pop', duration: 200 }}
    >
      <Popover.Target>
        <UnstyledButton
          onClick={() => setOpened((o) => !o)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 16px',
            borderRadius: '10px',
            background: opened
              ? 'rgba(84, 104, 255, 0.15)'
              : 'rgba(255, 255, 255, 0.05)',
            border: '1px solid',
            borderColor: opened
              ? 'rgba(84, 104, 255, 0.4)'
              : 'rgba(255, 255, 255, 0.1)',
            transition: 'all 0.2s ease',
            minWidth: '200px',
          }}
          className="hover:bg-white/10"
        >
          <Logo size={24} />
          <div style={{ flex: 1 }}>
            <Text size="sm" fw={500} c="white">
              {displayName}
            </Text>
            {selection.product && (
              <Text size="xs" c="dimmed">
                {selection.partner.name}
              </Text>
            )}
          </div>
          <motion.div
            animate={{ rotate: opened ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <IconChevronDown size={16} style={{ color: 'var(--mantine-color-dimmed)' }} />
          </motion.div>
        </UnstyledButton>
      </Popover.Target>

      <Popover.Dropdown
        style={{
          background: 'rgba(26, 27, 30, 0.98)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        {/* Search */}
        <Box p="sm" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <TextInput
            placeholder="Search partners or products..."
            leftSection={<IconSearch size={14} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="sm"
            variant="filled"
            autoFocus
            styles={{
              input: {
                background: 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                color: 'white',
                '&::placeholder': { color: 'rgba(255, 255, 255, 0.4)' },
              },
            }}
          />
        </Box>

        {/* Partner/Product List */}
        <ScrollArea h={350} type="auto" scrollbarSize={6}>
          <Box p="xs">
            <AnimatePresence>
              {filteredPartners.map((partner, partnerIndex) => {
                const PartnerLogo = getPartnerLogo(partner.key);
                const isSelectedPartner = selection.partner.key === partner.key;

                return (
                  <motion.div
                    key={partner.key}
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ delay: partnerIndex * 0.02 }}
                  >
                    {/* Partner Header */}
                    {partner.key !== 'all' && (
                      <Text
                        size="xs"
                        fw={600}
                        c="dimmed"
                        tt="uppercase"
                        px="sm"
                        pt={partnerIndex > 0 ? 'md' : 'xs'}
                        pb="xs"
                        style={{ letterSpacing: '0.5px' }}
                      >
                        {partner.name}
                      </Text>
                    )}

                    {/* "All Partners" option */}
                    {partner.key === 'all' && (
                      <PartnerItem
                        partner={partner}
                        isSelected={isSelectedPartner && !selection.product}
                        onClick={() => handleSelectPartner(partner)}
                      />
                    )}

                    {/* Products */}
                    {partner.products.map((product) => {
                      const isSelected =
                        isSelectedPartner && selection.product?.key === product.key;

                      return (
                        <ProductItem
                          key={product.key}
                          partner={partner}
                          product={product}
                          isSelected={isSelected}
                          onClick={() => handleSelectProduct(partner, product)}
                        />
                      );
                    })}
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {filteredPartners.length === 0 && (
              <Box py="xl" ta="center">
                <Text c="dimmed" size="sm">
                  No partners found
                </Text>
              </Box>
            )}
          </Box>
        </ScrollArea>
      </Popover.Dropdown>
    </Popover>
  );
}

// Partner item (for "All Partners")
interface PartnerItemProps {
  partner: Partner;
  isSelected: boolean;
  onClick: () => void;
}

function PartnerItem({ partner, isSelected, onClick }: PartnerItemProps) {
  const Logo = getPartnerLogo(partner.key);

  return (
    <UnstyledButton
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        padding: '10px 12px',
        borderRadius: '8px',
        background: isSelected ? 'rgba(84, 104, 255, 0.15)' : 'transparent',
        transition: 'all 0.15s ease',
      }}
      className="hover:bg-white/5"
    >
      <Logo size={20} />
      <Text size="sm" c="white" fw={isSelected ? 600 : 400} style={{ flex: 1 }}>
        {partner.name}
      </Text>
      {isSelected && <IconCheck size={16} color="var(--mantine-color-blue-4)" />}
    </UnstyledButton>
  );
}

// Product item
interface ProductItemProps {
  partner: Partner;
  product: Product;
  isSelected: boolean;
  onClick: () => void;
}

function ProductItem({ partner, product, isSelected, onClick }: ProductItemProps) {
  const Logo = getPartnerLogo(partner.key);

  return (
    <UnstyledButton
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        padding: '10px 12px',
        paddingLeft: '16px',
        borderRadius: '8px',
        background: isSelected ? 'rgba(84, 104, 255, 0.15)' : 'transparent',
        transition: 'all 0.15s ease',
      }}
      className="hover:bg-white/5"
    >
      <Logo size={18} />
      <div style={{ flex: 1 }}>
        <Text size="sm" c="white" fw={isSelected ? 600 : 400}>
          {product.name}
        </Text>
      </div>
      {product.count !== undefined && product.count > 0 && (
        <Badge size="xs" variant="light" color="blue">
          {product.count.toLocaleString()}
        </Badge>
      )}
      {isSelected && <IconCheck size={16} color="var(--mantine-color-blue-4)" />}
    </UnstyledButton>
  );
}
